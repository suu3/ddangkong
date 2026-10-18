param(
  [string]$KeystorePath = (Join-Path $env:USERPROFILE 'Downloads/android.keystore'),
  [switch]$PasswordDialog,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $env:USERPROFILE '.bubblewrap/config.json'
if (-not (Test-Path -LiteralPath $configPath)) { throw 'Run Bubblewrap once to configure JDK 17 and Android SDK.' }
$tools = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$keytool = Join-Path $tools.jdkPath 'bin/keytool.exe'
$jarsigner = Join-Path $tools.jdkPath 'bin/jarsigner.exe'
if (-not (Test-Path -LiteralPath $KeystorePath)) { throw "Signing key not found: $KeystorePath" }
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'android/twa-manifest.json') -Raw | ConvertFrom-Json
$alias = $manifest.signingKey.alias
$androidRoot = Join-Path $projectRoot 'android'
$buildTools = Get-ChildItem -LiteralPath (Join-Path $tools.androidSdkPath 'build-tools') -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $SkipBuild) {
  Push-Location $projectRoot
  try { & pnpm.cmd twa:update; if ($LASTEXITCODE -ne 0) { throw 'Android generation failed.' } }
  finally { Pop-Location }
  $previousJava = $env:JAVA_HOME; $previousAndroid = $env:ANDROID_HOME
  $gradleFile = Join-Path $androidRoot 'app/build.gradle'
  $gradleSource = Get-Content -LiteralPath $gradleFile -Raw
  $gradleSource = $gradleSource.Replace('compileSdkVersion 36', "compileSdkVersion 36`n    buildToolsVersion '$($buildTools.Name)'")
  Set-Content -LiteralPath $gradleFile -Value $gradleSource -Encoding utf8
  $env:JAVA_HOME = $tools.jdkPath; $env:ANDROID_HOME = $tools.androidSdkPath
  Push-Location $androidRoot
  try {
    & ./gradlew.bat --no-daemon assembleRelease bundleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed.' }
    & (Join-Path $buildTools.FullName 'zipalign.exe') -P 16 -f 4 app/build/outputs/apk/release/app-release-unsigned.apk app-release-unsigned-aligned.apk
    if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
  } finally { Pop-Location; $env:JAVA_HOME = $previousJava; $env:ANDROID_HOME = $previousAndroid }
}

if ($PasswordDialog) {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.Form
  $dialog.Text = 'Ddangkong Android signing'
  $dialog.Width = 430; $dialog.Height = 175; $dialog.StartPosition = 'CenterScreen'; $dialog.TopMost = $true
  $label = New-Object System.Windows.Forms.Label
  $label.Text = 'Enter the existing keystore password (local only):'; $label.Left = 16; $label.Top = 16; $label.Width = 390
  $inputBox = New-Object System.Windows.Forms.TextBox
  $inputBox.Left = 16; $inputBox.Top = 45; $inputBox.Width = 380; $inputBox.UseSystemPasswordChar = $true
  $button = New-Object System.Windows.Forms.Button
  $button.Text = 'Validate and build'; $button.Left = 240; $button.Top = 80; $button.Width = 155; $button.DialogResult = 'OK'
  $dialog.Controls.AddRange(@($label, $inputBox, $button)); $dialog.AcceptButton = $button
  if ($dialog.ShowDialog() -ne 'OK') { $dialog.Dispose(); throw 'Signing cancelled.' }
  $secret = ConvertTo-SecureString $inputBox.Text -AsPlainText -Force
  $inputBox.Clear(); $dialog.Dispose()
} else { $secret = Read-Host 'Existing keystore password (not saved)' -AsSecureString }

$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $env:DDANGKONG_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  $certificate = Join-Path $androidRoot 'upload-certificate.pem'
  & $keytool '-J-Duser.language=en' -exportcert -rfc -keystore $KeystorePath -alias $alias '-storepass:env' DDANGKONG_STORE_PASSWORD -file $certificate
  if ($LASTEXITCODE -ne 0) { throw 'Could not unlock the existing signing key. Check the password before resetting an upload key.' }
  $fingerprint = & node -e "const fs=require('fs'),crypto=require('crypto');process.stdout.write(new crypto.X509Certificate(fs.readFileSync(process.argv[1])).fingerprint256)" $certificate
  Write-Output "Signing certificate SHA-256: $fingerprint"
  # Public certificate metadata is safe to inspect; the private key and password stay local.
  @{ fingerprint = $fingerprint; alias = $alias; packageId = $manifest.packageId } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $androidRoot 'signing-certificate.json')
  Push-Location $projectRoot
  try {
    Push-Location $androidRoot
    try {
      $bundle = Join-Path $androidRoot 'app-release-bundle.aab'
      & $jarsigner '-storepass:env' DDANGKONG_STORE_PASSWORD '-keypass:env' DDANGKONG_STORE_PASSWORD -keystore $KeystorePath -signedjar $bundle 'app/build/outputs/bundle/release/app-release.aab' $alias
      if ($LASTEXITCODE -ne 0) { throw 'App Bundle signing failed.' }
      & $jarsigner -verify $bundle
      if ($LASTEXITCODE -ne 0) { throw 'App Bundle verification failed.' }
      $apksigner = Join-Path $buildTools.FullName 'lib/apksigner.jar'
      $java = Join-Path $tools.jdkPath 'bin/java.exe'
      & $java -jar $apksigner sign --ks $KeystorePath --ks-key-alias $alias --ks-pass env:DDANGKONG_STORE_PASSWORD --key-pass env:DDANGKONG_STORE_PASSWORD --out app-release-signed.apk app-release-unsigned-aligned.apk
      if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
      & $java -jar $apksigner verify --print-certs app-release-signed.apk
      if ($LASTEXITCODE -ne 0) { throw 'APK verification failed.' }
      Write-Output "Signed App Bundle: $bundle"
    } finally { Pop-Location }
  } finally { Pop-Location }
} finally {
  Remove-Item Env:DDANGKONG_STORE_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $secret.Dispose()
}
