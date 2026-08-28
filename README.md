# dollarpe-api

Get US dollar to Peruvian sol exchange rates from several online exchanges.

[https://dollarpe-api.cristianbgp.com/exchanges](https://dollarpe-api.cristianbgp.com/exchanges)

## Development

To install dependencies:

```sh
bun install --frozen-lockfile
```

To run:

```sh
bun run dev
```

Open http://localhost:3000.

To run the type checker and test suite:

```sh
bun run check
```

## Endpoints

`/exchanges`

Use the `sort` query parameter to order the best buy or sell rates:

- `/exchanges?sort=buy` (default): highest buy rate first
- `/exchanges?sort=sell`: lowest sell rate first

Each provider has a five-second timeout. Providers that time out, return an
unsuccessful HTTP status, or return invalid rates are omitted without failing
the complete response.

Rates are collected from:

- Rextie
- Kambista
- TKambio
- Roblex
- Decamoney
- TuCambista
- ChapaCambio
- Cambio Mundial
