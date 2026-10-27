export type AnimalType = "monkey" | "rabbit" | "elephant";

export type CollectibleType = "banana" | "carrot" | "apple";

export type Target = 1 | 2 | 3;

/** Learning stage. See ChallengeManager for what each level changes. */
export type Level = 1 | 2 | 3;

export interface Challenge {
  animal: AnimalType;
  item: CollectibleType;
  target: Target;
  available: number;
}

/** Ground position of a collectible, in world units. */
export interface Spot {
  x: number;
  z: number;
}

export interface ChallengeLayout extends Challenge {
  id: number;
  level: Level;
  positions: Spot[];
}

export const ANIMALS: readonly AnimalType[] = ["monkey", "rabbit", "elephant"];

export const FAVORITE_ITEM: Record<AnimalType, CollectibleType> = {
  monkey: "banana",
  rabbit: "carrot",
  elephant: "apple",
};
