# relay

seamlessly send your browser downloads to aria2.

## what it does

- intercepts browser downloads and sends them to aria2
- filters by size, file type, or url patterns
- shows nice in-page notifications
- works on linux, macos, windows

## setup

1. have aria2 running with rpc enabled
2. load extension in chrome (developer mode → load unpacked)
3. configure rpc url and token in options

## aria2 command

```
aria2c --enable-rpc --rpc-secret=SomethingSecure
```

## license

mit
