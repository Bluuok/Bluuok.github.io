export type SectionId = 'projects' | 'about' | 'contact';

export const features: { intro: boolean; particles: boolean; sections: SectionId[] } = {
  intro: true,
  particles: true,
  // Remove or reorder an entry to remove or reorder a whole section.
  sections: ['projects', 'about', 'contact'],
};
