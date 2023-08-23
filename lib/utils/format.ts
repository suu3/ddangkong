export const getDoubleDigitFormat = (value: number): string => {
  return value < 10 ? `0${value}` : `${value}`;
};
