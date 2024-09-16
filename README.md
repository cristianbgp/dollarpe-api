# dollarpe-api

Get dollar to peruvian sol exchange rate

[https://dollarpe-api.cristianbgp.com/exchanges](https://dollarpe-api.cristianbgp.com/exchanges)

## Development

To install dependencies:
```sh
bun install
```

To run:
```sh
bun run dev
```

open http://localhost:3000

## Endpoints

`/exchanges`

You can add sorting to get the better values for buy or sell with query param sort

`/exchanges?sort=buy` DEFAULT

`/exchanges?sort=sell`

This includes exchanges from:

- Rextie
- Kambista
- TKambio
- Roblex
- Decamoney
- TuCambista
- ChapaCambio