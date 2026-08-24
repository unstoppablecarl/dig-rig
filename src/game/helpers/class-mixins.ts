export type MixinConstructor<T = {}> = new (...args: any[]) => T;
export type AbstractMixinConstructor<T = {}> = abstract new (...args: any[]) => T

/**
 * @example

 function Timestamped<TBase extends MixinConstructor>(Base: TBase) {
 return class extends Base {
 timestamp: Date = new Date();
 };
 }
 */
