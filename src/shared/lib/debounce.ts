export function debounce<TArgs extends unknown[]>(callback: (...args: TArgs) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (...args: TArgs) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => callback(...args), delay);
  };
}
