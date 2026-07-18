# @nexora/create-plugin

Scaffold a new Nexora database driver plugin in seconds.

```bash
npm create @nexora/plugin@latest my-driver
```

## Usage

```bash
npx @nexora/create-plugin [options] <name>
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `--db-type` | `network \| file \| folder \| api` | `network` | Driver shape |
| `--quote` | `" \| \`` | `"` | Identifier quote character |
| `--with-ui` | boolean | off | Also scaffold a UI subworkspace |
| `--no-git` | boolean | off | Skip `git init` |
| `--dir` | path | `./<name>` | Target directory |

## License

Apache-2.0
