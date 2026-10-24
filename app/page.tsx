import HomeGameCatalog from '@/src/views/home/ui/HomeGameCatalog';
import GameMenu from '@/components/@layout/GameMenu';
import UniqueText from '@/components/UniqueText';
import Image from 'next/image';
import bombLogo from '@/public/hot-potato/bomb-v2.png';
import coffeeLogo from '@/public/logos/games/coffee.svg';
import rouletteLogo from '@/public/logos/games/roulette.svg';
import drawingRelayLogo from '@/public/logos/games/drawing-relay.svg';
import quizLogo from '@/public/logos/games/initial-quiz.svg';
import ladderLogo from '@/public/logos/games/ladder.svg';
import teamSplitLogo from '@/public/split-team/main-v2.png';
import { COFFEE_HOME, HOT_POTATO_HOME, ROULETTE_HOME, TEAM_SPLIT_HOME } from '@/lib/constants/serviceUrls';

const games = [
  {
    category: 'party',
    link: '/drawing-relay',
    title: '낙서 이어달리기',
    image: <Image src={drawingRelayLogo} width={120} height={120} alt="낙서 이어달리기" />,
    badges: [
      { label: 'NEW', tone: 'rose' as const },
      { label: '4~10명 · 각자 휴대폰', tone: 'blue' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description: '문장을 그림으로, 그림을 문장으로 전해요. 마지막에 엉뚱하게 달라진 이야기를 함께 펼쳐보세요.',
  },
  {
    category: 'penalty',
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
    category: 'penalty',
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
    category: 'party',
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
    category: 'party',
    link: TEAM_SPLIT_HOME,
    title: '랜덤 팀 나누기',
    image: (
      <Image
        src={teamSplitLogo}
        width={154}
        height={120}
        alt="랜덤 팀 나누기"
        className="h-[7.5rem] w-[9.625rem] object-contain"
      />
    ),
    badges: [
      { label: '1인 가능', tone: 'blue' as const },
      { label: '실시간 공유 가능', tone: 'amber' as const },
    ],
    description: '참여 인원을 입력하면 팀을 빠르게 랜덤 배정해 줘서 게임, 행사, 조별 활동 전에 바로 쓰기 좋아요.',
  },
  {
    category: 'penalty',
    link: '/ladder',
    title: '두근두근 사다리',
    image: <Image src={ladderLogo} width={120} height={120} alt="사다리 타기" />,
    badges: [
      { label: 'NEW', tone: 'rose' as const },
      { label: '2~8명 · 한 기기', tone: 'amber' as const },
    ],
    description: '이름과 결과를 적고 사다리를 따라가세요. 한 명씩 공개하거나 전체 결과를 한 번에 볼 수 있어요.',
  },
  {
    category: 'party',
    link: '/initial-quiz',
    title: '입이 근질근질 초성 퀴즈',
    image: <Image src={quizLogo} width={120} height={120} alt="초성 퀴즈" />,
    badges: [
      { label: 'NEW', tone: 'rose' as const },
      { label: '2~4팀 · 한 기기', tone: 'amber' as const },
    ],
    description: '음식·동물·생활 초성을 말로 맞혀보세요. 제한 시간 안에 정답을 많이 맞힌 팀이 승리해요.',
  },
] as const;

export default function Main() {
  return (
    <div className="flex flex-col items-center">
      <UniqueText font="sans" Tag="h1" size="lg" className="my-[1.94rem]">
        심심풀이 땅콩
      </UniqueText>
      <HomeGameCatalog
        categories={[
          { id: 'penalty', title: '벌칙·추첨', description: '누가 걸릴까? 운에 맡기는 즐거운 선택' },
          { id: 'party', title: '파티게임', description: '함께 모여 놀고, 팀을 나누고, 정답을 외쳐요' },
        ].map(category => ({
          ...category,
          content: (
            <div className="grid w-full grid-cols-2 gap-4">
              {games
                .filter(game => game.category === category.id)
                .map(game => (
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
          ),
        }))}
      />
    </div>
  );
}
