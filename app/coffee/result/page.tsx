'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import UniqueText from '@/components/UniqueText';
import { downloadScreenshot } from '@/lib/utils/image';
import { copyCurrentURL } from '@/lib/utils/clipboard';

import coffeeImage from '@/public/coffee/result.svg';
import walletImage from '@/public/coffee/wallet.svg';
import IconButton from '@/components/button/IconButton';
import linkIcon from '@/public/button/button_link.svg';
import refreshIcon from '@/public/button/button_refresh.svg';
import downloadIcon from '@/public/button/button_download.svg';
import { COFFEE_HOME } from '@/lib/constants/serviceUrls';

export default function CoffeeResult() {
  const screenRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const boom = searchParams.get('boom');

  const handleDownload = () => {
    if (!screenRef.current) return;

    downloadScreenshot(screenRef.current);
  };

  return (
    <div className="p-[2.33rem]" ref={screenRef}>
      <UniqueText Tag="p" size="lg" font="uhbee" className="text-center mb-2">
        오늘의 커피는
      </UniqueText>
      <UniqueText Tag="h1" size="lg" font="sans" className="text-center">
        <strong className="text-milkChocolate">{boom}번</strong>이 쏠게요!
      </UniqueText>

      <div className="mt-6 mb-[3.16rem] w-[18.5rem] h-[24.125rem] relative">
        <Image
          loading="eager"
          className="absolute w-full h-full"
          src={coffeeImage}
          priority
          alt="실망한 커피"
          width={296}
          height={386}
        />
        <Image className="absolute bottom-0 animate-bounce" width={97} height={136} src={walletImage} alt="지갑 커피" />
      </div>
      <div className="flex m-auto justify-evenly">
        <IconButton onClick={() => router.push(COFFEE_HOME)}>
          <Image src={refreshIcon} className="w-4 h-4" width={48} height={48} alt="처음으로 돌아가기 버튼" />
        </IconButton>
        <IconButton onClick={handleDownload}>
          <Image src={downloadIcon} className="w-4 h-4" width={48} height={48} alt="이미지 저장하기 버튼" />
        </IconButton>
        <IconButton onClick={copyCurrentURL}>
          <Image src={linkIcon} className="w-4 h-4" width={48} height={48} alt="링크 복사 버튼" />
        </IconButton>
      </div>
    </div>
  );
}
