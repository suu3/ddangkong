import clsx from "clsx";
import styles from "./main-button.module.css";

interface MainButtonProps {
  label: string;
  variant?: "contained"; //"outlined" |
  color?: "chocolate";
  className?: string;
}

const MainButton = ({
  label,
  variant = "contained",
  color = "chocolate",
  className,
}: MainButtonProps) => {
  const btnCls = clsx(
    styles["button"],
    styles[variant],
    styles[color],
    className
  );
  return <button className={btnCls}>{label}</button>;
};

export default MainButton;
