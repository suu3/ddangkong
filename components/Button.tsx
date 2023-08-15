import classNames from "classnames";
import styles from "./button.module.css";

interface ButtonProps {
  label: string;
  variant?: "contained"; //"outlined" |
  color?: "chocolate";
}

const Button = ({
  label,
  variant = "contained",
  color = "chocolate",
}: ButtonProps) => {
  const btnCls = classNames(styles["button"], styles[variant], styles[color]);
  return <button className={btnCls}>{label}</button>;
};

export default Button;
