import GameMenu from '@/components/@layout/GameMenu';
import UniqueText from '@/components/UniqueText';
import Image from 'next/image';
import coffeeLogo from '@/public/logos/games/coffee.svg';
import { COFFEE_HOME, ROULETTE_HOME } from '@/lib/constants/serviceUrls';

export default function Main() {
  return (
    <div className="flex flex-col items-center">
      <UniqueText font="sans" Tag="h1" size="lg" className="my-[1.94rem]">
        심심풀이 땅콩
      </UniqueText>
      <div className="grid grid-cols-2 w-full gap-4">
        <GameMenu
          link={COFFEE_HOME}
          title="커피내기 복불복"
          image={<Image src={coffeeLogo} width={64} height={120} alt="" />}
        />
        <GameMenu link={ROULETTE_HOME} title="운명의 돌림판" />
      </div>
    </div>
  );
}
