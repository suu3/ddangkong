import UniqueText from '@/components/UniqueText';
// import AudioPlayer from '@/components/AudioPlayer';
// import usePlayAudio from '@/lib/hooks/usePlayAudio';
import { Fragment, useContext, useEffect, useRef } from 'react';
import { RouletteContext } from '@/lib/context/roulette';
import clsx from 'clsx';
import Image from 'next/image';
import mainImage from '@/public/roulette/empty-roulette.svg';
import pinImage from '@/public/roulette/pin.svg';

interface LoadingProps {
  handleStep: (type: 'next' | 'prev') => void;
}

const Loading = ({ handleStep }: LoadingProps) => {
  const { orderState } = useContext(RouletteContext);
  const { angle, total } = orderState;
  let currentAngle = 0; // 현재 각도

  useEffect(() => {
    if (!document) return;

    const canvas = document.getElementById('wheelCanvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    const img = document?.getElementById('wheelImage');

    const radius = canvas?.width / 2; // 룰렛의 반지름

    spinRoulette();
    // console.log('ddd', total);
    // 룰렛 그리기
    function drawRoulette() {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 클리어
      ctx.save(); // 현재 상태를 저장
      ctx.translate(canvas.width / 2, canvas.height / 2); // 캔버스의 중심으로 이동
      ctx.rotate((currentAngle * Math.PI) / 180); // 현재 각도로 회전

      // ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
      ctx.restore(); // 이전 상태로 복원
      const x = canvas.width / 2;
      const y = canvas.height / 2;

      if (total.length <= 1) {
        const totalDegrees = 360;
        const angleIncrement = totalDegrees / total.length;
        const startAngle = currentAngle;
        const endAngle = startAngle + angleIncrement;

        // 세그먼트의 텍스트
        const angle = (endAngle + startAngle) / 2 - 90; // 부채꼴의 중앙 각도
        const radians = (angle * Math.PI) / 180;
        ctx.save();

        ctx.translate(x, y); // 텍스트 위치를 세그먼트 중앙으로 조정
        ctx.rotate(radians + Math.PI / 2); // 텍스트가 항상 올바른 방향으로 표시되도록 회전
        ctx.textAlign = 'center';
        ctx.font = '700 20px UhBeeTokki';
        ctx.fillText(total[0], 0, 0);
        ctx.restore();
        return;
      }
      // 세그먼트의 텍스트를 가운데에 배치
      total.forEach((segment, index) => {
        const totalDegrees = 360;
        const angleIncrement = totalDegrees / total.length;
        const startAngle = angleIncrement * index + currentAngle;
        const endAngle = startAngle + angleIncrement;
        const startRadians = ((startAngle - 90) * Math.PI) / 180;
        const endRadians = ((endAngle - 90) * Math.PI) / 180;

        // 세그먼트의 경계선
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + radius * Math.cos(startRadians), y + radius * Math.sin(startRadians));
        ctx.arc(x, y, radius, startRadians, endRadians); // 중심에서 반지름만큼 떨어진 위치에서 시작하여 호를 그림
        ctx.closePath(); // 세그먼트의 끝점에서 다시 중심으로 선을 그어 세그먼트를 완성
        ctx.stroke();

        // 세그먼트의 텍스트
        const angle = (endAngle + startAngle) / 2 - 90; // 부채꼴의 중앙 각도
        const radians = (angle * Math.PI) / 180;
        ctx.save();
        ctx.translate(x + radius * 0.5 * Math.cos(radians), y + radius * 0.5 * Math.sin(radians)); // 텍스트 위치를 세그먼트 중앙으로 조정
        ctx.rotate(radians + Math.PI / 2); // 텍스트가 항상 올바른 방향으로 표시되도록 회전
        ctx.textAlign = 'center';
        ctx.font = '700 20px UhBeeTokki';
        ctx.fillText(segment, 0, 0);
        ctx.restore();
      });
    }

    function spinRoulette() {
      let speed = 10; // 초기 속도
      const spinTime = 5000; // 회전 시간 (ms)
      const startTime = Date.now(); // 시작 시간

      function animate() {
        const currentTime = Date.now();
        const elapsedTime = currentTime - startTime;
        if (elapsedTime < spinTime) {
          currentAngle += speed;
          speed *= 0.99; // 감속 로직
          drawRoulette();
          requestAnimationFrame(animate);
        } else {
          // 회전 종료
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
          drawRoulette(); // 최종 상태 그리기
        }
      }
      animate();
    }
  }, []);

  return (
    <Fragment>
      {/* <AudioPlayer muted={allMuteState.isAllMuted} src="/sound/click.mp3" ref={playerRef} /> */}
      <div className="mt-[74px] relative w-[262px] h-[262px] mx-auto">
        <Image
          src={pinImage}
          className="absolute -top-[0.73rem] left-1/2 -translate-x-1/2 z-10"
          width={20.3}
          height={35.6}
          alt="고정 핀"
        />
        <Image
          src={mainImage}
          id="wheelImage"
          style={{
            zIndex: 0,
          }}
          className={clsx('absolute top-0')}
          width={262}
          height={262}
          alt="돌림판"
        />
        <canvas
          id="wheelCanvas"
          width="232"
          height="232"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
        ></canvas>
      </div>
    </Fragment>
  );
};

export default Loading;
