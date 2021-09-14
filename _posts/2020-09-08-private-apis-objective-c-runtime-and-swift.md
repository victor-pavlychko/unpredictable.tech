---
layout: post
title: Private APIs, Objective-C runtime, and Swift
---

Sometimes when building an app, we find ourselves in a situation when we want to use a private API.
It may provide some important functionality that is not exposed (yet), or we may want to work around
a known platform issue. Or, you may be just debugging your code and poking around to get extra details.

<!-- more -->

> Whatever you are trying to achieve, keep in mind that private APIs are fragile and can change without
notice, leaving you with a broken product and frustrated users.

Swift adds another dimension here: restricted APIs marked as
[`NS_SWIFT_UNAVAILABLE`](https://developer.apple.com/documentation/swift/objective-c_and_c_code_customization/making_objective-c_apis_unavailable_in_swift).
Those are not technically private, but they are considered not safe enough and thus are not exposed in Swift.
Calling into such unavailable APIs is pretty ok as they are fully documented and accessible from
Objective-C code. This post will focus on accessing a group of Swift-unavailable APIs related to dynamic
message dispatch provided by
[`NSMethodSignature`](https://developer.apple.com/documentation/foundation/nsmethodsignature),
[`NSInvocation`](https://developer.apple.com/documentation/foundation/nsinvocation),
and [`NSObject`](https://developer.apple.com/documentation/objectivec/nsobject/1571960-methodsignatureforselector?language=objc)
classes. I encourage you to check the documentation if you are not familiar with those.

Nothing is private as long as Objective-C runtime is involved. Things have changed slightly with
the introduction of direct methods. Still, a lot of APIs remain accessible if you know how to
invoke them.

## Invoking private APIs from Swift

But how do you call a method that is not exposed by the SDK? Back in the Objective-C days, everything
was easy&nbsp;— thanks to the language’s dynamic nature, you could declare a category with any private methods.
They would automatically resolve at runtime.

Swift is a type-safe language, and you no longer allowed to do that. Common approaches rely on
Swift-compatible Foundation APIs like
[`perform(_:)`](https://developer.apple.com/documentation/objectivec/nsobjectprotocol/1418867-perform)
for simple functions or low-level
[`method_getImplementation`](https://developer.apple.com/documentation/objectivec/1418551-method_getimplementation)
and/or
[`objc_msgSend`](https://developer.apple.com/documentation/objectivec/1456712-objc_msgsend)
when dealing with more sophisticated signatures. Unfortunately, this results in
complicated, verbose, and error-prone code.

Can we do something better? While the original category-based approach is not available in Swift, we
can try something similar&nbsp;— we are still calling into Objective-C.

### A cleaner approach

The idea is analogous to the category trick we did previously: we can define an `@objc` protocol containing
methods of interest, use the runtime to add conformance to the class in question retroactively, and
then ask Swift to do the typecast. Thanks to the dynamic dispatch used in everything coming from the
Objective-C world, the protocol will be implemented automatically by existing class methods we are
looking for.

To get started, we will define a protocol for `NSMethodSignature` matching what we can see in
the Objective-C documentation. Notice the `@objc(getArgumentTypeAtIndex:)` annotation I used here.
Normally, the compiler will generate the appropriate selector based on the method name, yet we may
want to alter the auto-generated name. Using correct selector names is crucial in our case, where
we have to match underlying API signatures perfectly.

```swift
@objc protocol NSMethodSignaturePrivate {
    static func signature(objCTypes: UnsafePointer<CChar>) -> NSMethodSignaturePrivate?
    var numberOfArguments: Int { get }
    @objc(getArgumentTypeAtIndex:) func getArgumentType(at index: Int) -> UnsafePointer<CChar>
    var frameLength: Int { get }
    var isOneway: ObjCBool { get }
    var methodReturnType: UnsafePointer<CChar> { get }
    var methodReturnLength: Int { get }
}
```

Once we have that protocol, we can attach it with explicit objc runtime calls:

```swift
// Obtain class reference from runtime:
let `class` = "NSMethodSignature".withCString {
    return objc_getClass($0) as! AnyClass
}

// Add protocol conformance:
class_addProtocol(`class`, NSMethodSignaturePrivate.self)

// Get `NSMethodSignaturePrivate.Type` meta-type reference
let NSMethodSignatureClass = `class` as! NSMethodSignaturePrivate.Type
```

Whoa, that’s some boilerplate, and we haven’t added any error checks yet&nbsp;— looks like the right
candidate for a helper function. We will fix that right after testing that everything works
as expected.

We will be working with method signatures here, and if you are not familiar with those, I recommend
reading [an excellent article from NSHipster](https://nshipster.com/type-encodings/) to learn more
about type encoding in Objective-C. As a quick recap, I’ll remind that `v@:` signature stays
for "a method that returns void and accepts two implicit parameters: instance reference and method selector."

```swift
// Call private class function:
let signature = "v@:".withCString {
    return NSMethodSignatureClass.signature(objCTypes: $0)
}

// Call private instance function:
print("Number of arguments: \(signature!.numberOfArguments)")
```

As intended, this says, "Number of arguments: 2," which means that we have successfully constructed
a signature for a method accepting two parameters.

### Reducing boilerplate

Now back to the class import code. At first, it seems like we can leverage generics in a helper function
to remove protocol reference duplication like this:

```swift
func importClass<T>(_ className: String, as protocol: T.Type) -> T.Type {
    fatalError("Not implemented yet.")
}

let NSMethodSignatureClass = importClass("NSMethodSignature", as: NSMethodSignaturePrivate.self)
let signature = "v@:".withCString(NSMethodSignatureClass.signature(objCTypes:))
```

Except this fails to compile, producing an error: "Static member `signature(objCTypes:)` cannot be
used on protocol metatype `NSMethodSignaturePrivate.Protocol`."

You see, `NSMethodSignaturePrivate` is a protocol, and thus we need a concrete conforming type to
create an `NSMethodSignaturePrivate.Type` value. Because of that, the `NSMethodSignaturePrivate.self`
syntax was repurposed to produce an `NSMethodSignaturePrivate.Protocol`, which we can use with
runtime functions. But that thing does not allow us to call class functions like
`signature(objCTypes:)`.

Let’s give it another try:

```swift
func importClass<ProtocolType>(_ className: String) -> ProtocolType {
    fatalError("Not implemented yet.")
}

let NSMethodSignatureClass = importClass("NSMethodSignature") as NSMethodSignaturePrivate.Type
let signature = "v@:".withCString(NSMethodSignatureClass.signature(objCTypes:))
```

Now, this looks better, but how do we get `NSMethodSignaturePrivate.Protocol` from
`NSMethodSignaturePrivate.Type`? I haven’t found any clear way to convert between those two,
but we can use the type name as a middle ground here&nbsp;— use Swift reflection API to get the
protocol name and then find it’s runtime counterpart with `objc_getProtocol`:

```swift
func importClass<ProtocolType>(_ className: String) -> ProtocolType {
    let typeNameSuffix = ".Type"

    let protocolTypeName = String(reflecting: ProtocolType.self)
    guard protocolTypeName.hasSuffix(typeNameSuffix) else {
        preconditionFailure("Type `\(protocolTypeName)` is not a protocol type.")
    }

    let protocolName = protocolTypeName.dropLast(typeNameSuffix.count)
    guard let `protocol` = protocolName.withCString(objc_getProtocol) else {
        preconditionFailure("Type `\(protocolName)` is not an objc protocol.")
    }

    guard let `class` = className.withCString(objc_getClass) as? AnyClass else {
        preconditionFailure("Class `\(className)` not found.")
    }

    if !class_addProtocol(`class`, `protocol`) {
        assertionFailure("Failed to attach protocol `\(protocolName)` to class `\(className)`.")
    }

    guard let result = `class` as? ProtocolType else {
        fatalError("Failed to cast class `\(className)` to protocol `\(protocolName)`.")
    }

    return result
}
```

## Conclusion

Objective-C runtime, together with Swift expressiveness, provides a lot of opportunities.
We can access Swift-restricted or private APIs using a little hacking, just like we did
in Objective-C (all safety measures are on us, though):

```swift
let object = NSDate()
let objectPrivate = object as! NSObjectPrivate
let selector = Selector("description")
let signature = objectPrivate.methodSignature(for: selector)!
let invocation = NSInvocationClass.invocation(methodSignature: signature)
invocation.selector = selector
invocation.invoke(target: object)
var unmanagedResult: Unmanaged<NSString>? = nil
invocation.getReturnValue(&unmanagedResult)
let result = unmanagedResult?.takeRetainedValue()
print(result ?? "<nil>")
```

Check this gist for a full example: [https://gist.github.com/victor-pavlychko/8a896917d8c73f4dded594ab4782214e](https://gist.github.com/victor-pavlychko/8a896917d8c73f4dded594ab4782214e)
