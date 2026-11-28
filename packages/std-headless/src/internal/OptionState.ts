/** What an `option` slot reads about the option it renders (std.options). */
export type OptionState = {
  active(): boolean;
  selected(): boolean;
};
