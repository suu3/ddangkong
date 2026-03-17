import GameMenu from '@/components/@layout/GameMenu';
import UniqueText from '@/components/UniqueText';
import Image from 'next/image';
import bombLogo from '@/public/hot-potato/bomb.png';
import coffeeLogo from '@/public/logos/games/coffee.svg';
import rouletteLogo from '@/public/logos/games/roulette.svg';
import teamSplitLogo from '@/public/split-team/main.png';
import { COFFEE_HOME, HOT_POTATO_HOME, ROULETTE_HOME, TEAM_SPLIT_HOME } from '@/lib/constants/serviceUrls';

export default function Main() {
  return (
    <div className="flex flex-col items-center">
      <UniqueText font="sans" Tag="h1" size="lg" className="my-[1.94rem]">
        랜덤게임천국
      </UniqueText>
      <div className="grid grid-cols-2 w-full gap-4">
        <GameMenu
          link={COFFEE_HOME}
          title="커피내기 복불복"
          image={<Image src={coffeeLogo} width={64} height={120} alt="커피내기" />}
        />
        <GameMenu
          link={ROULETTE_HOME}
          title="이름 룰렛"
          image={<Image src={rouletteLogo} width={110} height={120} alt="이름 룰렛" />}
        />
        <GameMenu
          link={HOT_POTATO_HOME}
          title="폭탄 돌리기"
          image={
            <Image
              src={bombLogo}
              width={154}
              height={154}
              alt="폭탄 돌리기"
              className="h-[7.2rem] w-[7.2rem] object-contain"
            />
          }
        />
        <GameMenu
          link={TEAM_SPLIT_HOME}
          title="랜덤 팀 나누기"
          image={
            <Image
              src={teamSplitLogo}
              width={96}
              height={96}
              alt="랜덤 팀 나누기"
              className="h-24 w-24 object-contain"
            />
          }
        />
      </div>
    </div>
  );
}
