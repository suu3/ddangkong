import Button from "@/components/Button";
import mainImage from "@/public/coffee/main.svg";
import Image from "next/image";

export default function Coffee() {
  return (
    <section className="flex flex-col justify-between items-center font-normal">
      <h1 className="text-chocolate font-sans text-xl text-center ">
        커피내기
        <br />
        <strong className="text-4xl font-normal">복불복</strong>
      </h1>
      <Image
        src={mainImage}
        alt="다섯 명이 종이를 내밀고 있고 두 명이 해골이 그려진 종이를 들고 있음"
      />
      <Button label="시작하기" variant="contained" color="chocolate" />
    </section>
  );
}
