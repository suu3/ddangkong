export const roomErrorMessage = (code: string | null) => {
  if (!code) return null;
  const messages: Record<string, string> = {
    ROOM_NOT_FOUND_OR_EXPIRED: '방을 찾을 수 없거나 만료된 링크예요. 새 방을 만들어 주세요.',
    ROOM_EXPIRED: '방을 찾을 수 없거나 만료된 링크예요. 새 방을 만들어 주세요.',
    GAME_STARTED: '이미 시작한 방이에요. 다음 게임에 함께해 주세요.',
    NOT_READY: '4명 이상 모두 준비되면 시작할 수 있어요.',
    STALE_TURN: '다음 차례로 넘어갔어요. 현재 화면을 확인해 주세요.',
    TURN_EXPIRED: '시간이 끝나 저장된 내용으로 전달됐어요.',
    INVALID_DRAWING: '그림이 너무 복잡해요. 되돌리기로 조금 줄여 주세요.',
    INVALID_CONTENT: '문장은 100자 이내로 적어 주세요.',
    INVALID_NICKNAME: '닉네임은 1~20자로 적어 주세요.',
    NOT_A_PLAYER: '닉네임을 적고 먼저 참가해 주세요.',
    ROOM_FULL: '방 정원이 가득 찼어요.',
    TOO_MANY_CONNECTIONS: '접속한 탭이 너무 많아요. 다른 탭을 닫고 다시 접속해 주세요.',
    REQUEST_RATE_LIMITED: '접속 요청이 너무 많아요. 1분 뒤에 다시 시도해 주세요.',
    ROOM_RATE_LIMITED: '방을 너무 자주 만들었어요. 10분 뒤에 다시 시도해 주세요.',
    HOST_PERMISSION_REQUIRED: '방을 만든 진행자만 조작할 수 있어요.',
    MUTATION_NOT_ALLOWED: '지금은 이 동작을 할 수 없어요. 최신 상태를 확인해 주세요.',
    ROOM_SESSION_REQUIRED: '방 접속 정보가 유효하지 않아요. 방 링크를 다시 확인해 주세요.',
    NOT_CONNECTED: '서버에 연결한 뒤 다시 시도해 주세요.',
    CONNECTION_LOST: '연결이 끊겼어요. 다시 연결되면 시도해 주세요.',
    REQUEST_TIMEOUT: '응답을 확인하지 못했어요. 연결 상태를 확인해 주세요.',
    STALE_REVISION: '다른 참여자가 상태를 바꿨어요. 다시 시도해 주세요.',
    GAME_TYPE_MISMATCH: '이 링크는 다른 게임의 방이에요. 공유받은 원래 링크로 접속해 주세요.',
    COOLDOWN: '잠시 기다린 뒤 전달해 주세요.',
  };
  return messages[code] ?? '실시간 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
};
