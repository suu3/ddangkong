'use client';

import { Suspense, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import UniqueText from '@/components/UniqueText';
import MainButton from '@/components/button/MainButton';
import { useSound } from '@/lib/context/sound';
import { downloadScreenshot } from '@/lib/utils/image';
import { copyCurrentURL } from '@/lib/utils/clipboard';
import { COFFEE_HOME } from '@/lib/constants/serviceUrls';
import coffeeImage from '@/public/coffee/result.svg';
import walletImage from '@/public/coffee/wallet.svg';
import linkIcon from '@/public/button/button_link.svg';
import refreshIcon from '@/public/button/button_refresh.svg';
import downloadIcon from '@/public/button/button_download.svg';

function CoffeeResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boom = searchParams.get('boom');
  const muted = searchParams.get('muted') !== 'false';
  const { setMuted } = useSound();

  const screenRef = useRef(null);

  const handleDownload = () => {
    if (!screenRef.current) return;

    downloadScreenshot(screenRef.current);
  };

  useEffect(() => {
    setMuted(muted);
  }, [muted, setMuted]);

  return (
    <div className="p-[2.33rem]" ref={screenRef}>
      <UniqueText Tag="p" size="lg" font="uhbee" className="text-center mb-2">
        오늘의 커피는
      </UniqueText>
      <UniqueText Tag="h1" size="lg" font="sans" className="text-center">
        <strong className="text-milkChocolate">{boom}번</strong> 당첨됐어요
      </UniqueText>

      <div className="mt-6 mb-[3.16rem] w-[18.5rem] h-[24.125rem] relative">
        <Image
          loading="eager"
          className="absolute w-full h-full"
          src={coffeeImage}
          priority
          alt="?ㅻ쭩??而ㅽ뵾"
          width={296}
          height={386}
        />
        <Image
          className="absolute bottom-0 animate-bounce"
          width={97}
          height={136}
          src={walletImage}
          alt="吏媛?而ㅽ뵾"
        />
      </div>
      <div className="flex m-auto justify-evenly">
        <MainButton variant="icon" onClick={() => router.push(COFFEE_HOME)}>
          <Image src={refreshIcon} className="w-4 h-4" width={48} height={48} alt="泥섏쓬?쇰줈 ?뚯븘媛湲?踰꾪듉" />
        </MainButton>
        <MainButton variant="icon" onClick={handleDownload}>
          <Image src={downloadIcon} className="w-4 h-4" width={48} height={48} alt="?대?吏 ??ν븯湲?踰꾪듉" />
        </MainButton>
        <MainButton variant="icon" onClick={copyCurrentURL}>
          <Image src={linkIcon} className="w-4 h-4" width={48} height={48} alt="留곹겕 蹂듭궗 踰꾪듉" />
        </MainButton>
      </div>
    </div>
  );
}

export default function CoffeeResult() {
  return (
    <Suspense fallback={<div className="h-screen w-screen" />}>
      <CoffeeResultContent />
    </Suspense>
  );
}
