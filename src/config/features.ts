export type SectionId = 'projects' | 'about' | 'contact';

export interface FeaturesConfig {
  /** @deprecated Compatibility only; use firstSpark. Home introduction always renders. */
  intro: boolean;
  /** Ambient micro-particle field on hero */
  particles: boolean;
  /** Section order and toggles on index page */
  sections: SectionId[];
  /** Fabric of Thought section toggle */
  cloth: boolean;
  /** First Spark experiment toggle */
  firstSpark: boolean;
}

export const features: FeaturesConfig = {
  intro: false,
  particles: true,
  sections: ['projects', 'about', 'contact'],
  cloth: true,
  firstSpark: true,
};
