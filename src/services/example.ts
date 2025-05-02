// Core business logic
const getRandom = (): number => {
  return Math.floor(Math.random() * 100);
};

const sum = (a: number, b: number): number => {
  return a + b;
};

const updateNumber = (number: number): number => {
  return number * 2;
};

const patchNumber = (number: number): number => {
  return number + 1;
};

export { getRandom, sum, updateNumber, patchNumber };
