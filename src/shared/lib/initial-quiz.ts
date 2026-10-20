const CHOSEONG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
];
export function initials(word: string): string {
  return Array.from(word)
    .map(char => {
      const offset = char.charCodeAt(0) - 0xac00;
      return offset >= 0 && offset < 11172 ? CHOSEONG[Math.floor(offset / 588)] : char;
    })
    .join('');
}
export const QUIZ_WORDS = {
  food: '김치,비빔밥,떡볶이,불고기,삼겹살,김밥,라면,냉면,짜장면,짬뽕,탕수육,만두,순대,어묵,칼국수,수제비,된장찌개,김치찌개,미역국,갈비탕,삼계탕,설렁탕,감자탕,육개장,잡채,해물파전,치킨,피자,햄버거,샌드위치,핫도그,스파게티,볶음밥,돈가스,초밥,우동,오므라이스,카레,샐러드,스테이크,사과,바나나,딸기,수박,복숭아,포도,파인애플,오렌지,키위,망고,아이스크림,팥빙수,와플,마카롱,초콜릿,푸딩,케이크,쿠키,도넛,붕어빵'.split(
    ','
  ),
  animals:
    '강아지,고양이,토끼,햄스터,고슴도치,다람쥐,기니피그,앵무새,참새,비둘기,까치,까마귀,독수리,부엉이,올빼미,펭귄,타조,공작새,오리,거위,백조,두루미,기러기,제비,갈매기,사자,호랑이,표범,치타,코끼리,기린,하마,코뿔소,얼룩말,고릴라,침팬지,오랑우탄,캥거루,코알라,판다,북극곰,불곰,여우,늑대,너구리,수달,족제비,사슴,순록,낙타,돌고래,고래,상어,바다표범,바다사자,해파리,문어,오징어,불가사리,해마'.split(
      ','
    ),
  life: '냉장고,세탁기,청소기,전자레인지,에어컨,선풍기,텔레비전,컴퓨터,노트북,스마트폰,키보드,마우스,이어폰,스피커,충전기,보조배터리,리모컨,시계,안경,선글라스,모자,장갑,목도리,양말,운동화,슬리퍼,가방,지갑,우산,손수건,칫솔,치약,수건,비누,샴푸,거울,빗자루,쓰레기통,휴지,물티슈,연필,지우개,볼펜,공책,책가방,가위,색연필,풀,자,계산기,도서관,영화관,편의점,놀이터,공원,수영장,체육관,미술관,박물관,동물원'.split(
    ','
  ),
};
export type QuizCategory = keyof typeof QUIZ_WORDS | 'mixed';
export function quizDeck(category: QuizCategory): string[] {
  const deck = category === 'mixed' ? Object.values(QUIZ_WORDS).flat() : [...QUIZ_WORDS[category]];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export interface QuizState {
  phase: 'ready' | 'playing' | 'between' | 'finished';
  team: number;
  scores: number[];
  duration: number;
  deadline: number;
  card: number;
  revealed: boolean;
  decks: string[][];
}
export type QuizEvent = { type: 'start' | 'reveal' | 'pass' | 'correct' | 'tick' | 'next' | 'finish'; now: number };
export function createQuiz(teams: number, duration: number, words: string[]): QuizState {
  if (!Number.isInteger(teams) || teams < 2 || teams > 4 || ![30, 60, 90].includes(duration) || words.length < teams)
    throw new Error('게임 설정을 확인해주세요.');
  return {
    phase: 'ready',
    team: 0,
    scores: Array(teams).fill(0),
    duration,
    deadline: 0,
    card: 0,
    revealed: false,
    decks: Array.from({ length: teams }, (_, team) => words.filter((_, i) => i % teams === team)),
  };
}
export function advanceQuiz(state: QuizState, event: QuizEvent): QuizState {
  const end = () => ({
    ...state,
    phase: state.team === state.scores.length - 1 ? ('finished' as const) : ('between' as const),
  });
  if (event.type === 'next' && state.phase === 'between')
    return { ...state, phase: 'ready', team: state.team + 1, card: 0, revealed: false };
  if (event.type === 'start' && state.phase === 'ready')
    return { ...state, phase: 'playing', deadline: event.now + state.duration * 1000 };
  if (state.phase !== 'playing') return state;
  if (event.now >= state.deadline || event.type === 'finish') return end();
  if (event.type === 'reveal') return { ...state, revealed: true };
  if (event.type === 'correct' || event.type === 'pass') {
    const scores = state.scores.map((score, i) => score + (i === state.team && event.type === 'correct' ? 1 : 0));
    const card = state.card + 1;
    return {
      ...state,
      scores,
      card,
      revealed: false,
      phase:
        card >= state.decks[state.team].length
          ? state.team === state.scores.length - 1
            ? 'finished'
            : 'between'
          : 'playing',
    };
  }
  return state;
}
