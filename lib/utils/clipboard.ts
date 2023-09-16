export const copyCurrentURL = () => {
  const currentURL = window.location.href;

  navigator.clipboard
    .writeText(currentURL)
    .then(() => {
      console.log('URL이 클립보드에 복사되었습니다.');
    })
    .catch(error => {
      console.error('URL 복사 중 오류 발생:', error);
    });
};
