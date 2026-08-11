type Ctor = (new (...args: never[]) => unknown) & { prototype: object };

export function inherits(ctor: Ctor, superCtor: Ctor): void {
  (ctor as { super_?: Ctor }).super_ = superCtor;
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  Object.setPrototypeOf(ctor, superCtor);
}
