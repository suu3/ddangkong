import GameMenu from '@/components/@layout/GameMenu';
import UniqueText from '@/components/UniqueText';
import Image from 'next/image';
import bombLogo from '@/public/hot-potato/bomb.png';
import coffeeLogo from '@/public/logos/games/coffee.svg';
import rouletteLogo from '@/public/logos/games/roulette.svg';
import teamSplitLogo from '@/public/split-team/main.png';
import { COFFEE_HOME, HOT_POTATO_HOME, ROULETTE_HOME, TEAM_SPLIT_HOME } from '@/lib/constants/serviceUrls';

const games = [
  {
    link: COFFEE_HOME,
    title: '커피내기 복불복',
    image: <Image src={coffeeLogo} width={64} height={120} alt="커피내기 복불복" />,
    badges: [
      { label: '1인 가능', tone: 'blue' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description: '인원 수를 정하고 커피 폭탄을 섞은 뒤 한 명씩 선택하는 가장 클래식한 복불복 게임이에요.',
  },
  {
    link: ROULETTE_HOME,
    title: '운명의 돌림판',
    image: <Image src={rouletteLogo} width={110} height={120} alt="운명의 돌림판" />,
    badges: [
      { label: '1인 가능', tone: 'blue' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description: '항목만 넣으면 바로 돌릴 수 있어서 벌칙, 메뉴 결정, 랜덤 선택처럼 빠른 결정이 필요할 때 잘 어울려요.',
  },
  {
    link: HOT_POTATO_HOME,
    title: '폭탄 돌리기',
    image: (
      <Image
        src={bombLogo}
        width={154}
        height={154}
        alt="폭탄 돌리기"
        className="h-[7.2rem] w-[7.2rem] object-contain"
      />
    ),
    badges: [
      { label: '2인 이상', tone: 'rose' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description:
      '같은 링크로 모여 타이머가 끝나기 전에 폭탄을 넘기는 실시간 게임이라, 친구들과 함께할 때 긴장감이 커져요.',
  },
  {
    link: TEAM_SPLIT_HOME,
    title: '랜덤 팀 나누기',
    image: (
      <Image src={teamSplitLogo} width={96} height={96} alt="랜덤 팀 나누기" className="h-24 w-24 object-contain" />
    ),
    badges: [
      { label: '2인 이상', tone: 'rose' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description: '참여 인원을 입력하면 팀을 빠르게 랜덤 배정해 줘서 게임, 행사, 조별 활동 전에 바로 쓰기 좋아요.',
  },
] as const;

export default function Main() {
  return (
    <div className="flex flex-col items-center">
      <UniqueText font="sans" Tag="h1" size="lg" className="my-[1.94rem]">
        딴콩 게임센터
      </UniqueText>
      <div className="grid w-full grid-cols-2 gap-4">
        {games.map(game => (
          <GameMenu
            key={game.link}
            link={game.link}
            title={game.title}
            image={game.image}
            badges={game.badges}
            description={game.description}
          />
        ))}
      </div>
    </div>
  );
}
