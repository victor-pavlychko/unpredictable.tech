---
layout: post
title: Generic Optional Handling in Swift
---

Sometimes you want to write a generic algorithm working on any `Optional` type no matter what actual type
is wrapped inside. Ok, this can be easily done with a free generic function, but what if you want to write
a `Sequence` extension to remove all `nil` values for example?

Things get a little bit complicated here since `Optional` is not a protocol but a concrete type and so it
can’t be used as a generic type constraint.

<!-- more -->

Generic protocols and concrete types in Swift serve different purposes: we create instances and declare
variables of concrete types while protocols can be used as a generic type constraints.

Type erasure is a technique used in case we want to declare a variable able to hold any concrete type
conforming to a specific protocol. What we want here instead is another part of the same puzzle, we need
a protocol allowing us to use the concrete generic type as a constraint.

This may sound complicated in English but, as it usually happens, looks much simpler when
written in plain Swift 😄

```swift
public protocol OptionalType: ExpressibleByNilLiteral {
    associatedtype WrappedType
    var asOptional: WrappedType? { get }
}

extension Optional: OptionalType {
    public var asOptional: Wrapped? {
        return self
    }
}
```

So here we just define an `OptionalType` protocol declaring `WrappedType` associated type and conform `Optional`
enum to it. Note that generic type parameters do not automatically fulfill protocol requirements, but we
have type inference covering us here.

In order to make the protocol useful we expose some basic `Optional` functionality:

- `asOptional` property gives us an access to the optional binding syntax.

- `ExpressibleByNilLiteral` conformance allows us to use nil for initialization.

Having done that, we can now use `OptionalType` as a generic constraint:

```swift
public extension Sequence where Self.Iterator.Element: OptionalType {
    public func removingNils() -> [Self.Iterator.Element.WrappedType] {
        return flatMap { $0.asOptional }
    }
}
```

If you are looking for more tricks that can be done with the `Optional` enum,
you should check [an excellent article by Russ Bishop](http://www.russbishop.net/improving-optionals).
