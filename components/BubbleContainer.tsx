import bubbleImage from "@/public/coffee/bubble.svg";
import clsx from "clsx";
import styles from "./bubble-container.module.css";
import Image from "next/image";

interface BubbleContainerProps {
  width: number;
  height: number;
  className?: string;
  children?: React.ReactNode;
}

const BubbleContainer = ({
  width,
  height,
  className,
  children,
}: BubbleContainerProps) => {
  return (
    <div
      className={clsx(styles["wrapper"], className)}
      style={{
        width: width,
        height: height,
      }}
    >
      <Image
        src={bubbleImage}
        fill
        sizes="100%"
        alt=""
        className={styles["bubble-img"]}
      />
      <div className={styles["bubble-text"]}>{children}</div>
    </div>
  );
};

export default BubbleContainer;
