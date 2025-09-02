declare module '../jokes' {
  export function getRandomJoke(): string;
  export const vasyaJokes: string[];
}

declare module '../../jokes' {
  export function getRandomJoke(): string;
  export const vasyaJokes: string[];
}
