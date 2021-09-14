---
layout: post
title: Using Self in Swift Class Extensions
---

It might be tempting to use `Self` as a parameter type when extending classes but Swift only allows it
in a protocol or as the result of a class method invocation.

In fact, this is a semantically correct restriction for non-final classes in most cases, except when we
want to use `Self` as an argument of the closure, think about completion handlers for example. In that case
`Self` is used just as an another method call result which is absolutely valid option.

<!-- more -->

My favorite example here is the continuation helper for the Operation class:

- Using continuation operation instead of completion block gives control over its execution context.

- I tend to define result accessors in my Operation subclasses and I usually want to access them in
a continuation.

- Accessing operation from the continuation does not introduce a retain cycle because any operation already
owns its dependencies.

So we need to pass a block receiving operation that has just finished execution as a parameter. That is not
allowed in a class extension.

Hm, but we can use Self that way in a protocol, right… Protocols to the rescue! The plan is to define a
dummy protocol, conform our class to it and extend the protocol instead of the class.

```swift
public protocol BlockContinuable { }

extension Operation: BlockContinuable { }

public extension BlockContinuable where Self: Operation {
    public func `continue`(on queue: OperationQueue = .main, with block: @escaping (Self) -> Void) {
        let continuation = BlockOperation { block(self) }
        continuation.addDependency(self)
        queue.addOperation(continuation)
    }
}
```

Now we can use our `continue(on:with:)` extension and access operation result in a type-safe manner:

```swift
public class SampleOperation: Operation {
    public var result: String?
    public override func main() {
        result = "Hello, Continuation!"
    }
}

let operation = SampleOperation()

operation.continue {
    print($0.result ?? "operation failed")
}

OperationQueue.main.addOperation(operation)
```
