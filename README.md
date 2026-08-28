# dollarpe-api

Get US dollar to Peruvian sol exchange rates from online exchanges and the
official SUNAT reference rate.

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

Interactive Swagger documentation is available at [`/docs`](https://dollarpe-api.cristianbgp.com/docs).
The generated OpenAPI 3.1 document is available at
[`/openapi.json`](https://dollarpe-api.cristianbgp.com/openapi.json).

### `GET /exchanges`

Get the current rates from every available provider:

```text
/exchanges
```

Use the `sort` query parameter to order the best buy or sell rates:

```text
/exchanges?sort=buy
/exchanges?sort=sell
```

- `buy` is the default and sorts the highest buy rate first.
- `sell` sorts the lowest sell rate first.

Example response:

```json
[
  [
    "sunat",
    {
      "buy": 3.34,
      "sell": 3.348,
      "pageUrl": "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias"
    }
  ]
]
```

Each provider has a five-second timeout. Providers that time out, return an
unsuccessful HTTP status, or return invalid rates are omitted without failing
the complete response. If every provider fails, the endpoint returns `503`
instead of an empty successful response.

An unsupported `sort` value returns `400`.

Rates are collected from:

- Rextie
- Kambista
- TKambio
- Roblex
- Decamoney
- TuCambista
- ChapaCambio
- Cambio Mundial
- SUNAT (official reference rate)

### `GET /official-rate`

Get today's official SUNAT rate using the current date in `America/Lima`:

```text
/official-rate
```

Use the optional `date` query parameter for a historical rate:

```text
/official-rate?date=2025-11-17
```

The date must use the `YYYY-MM-DD` format and cannot be in the future. On days
without a new publication, such as weekends or holidays, the endpoint returns
the latest available official rate.

Example response:

```json
{
  "source": "sunat",
  "date": "2025-11-17",
  "buy": 3.365,
  "sell": 3.374,
  "pageUrl": "https://e-consulta.sunat.gob.pe/cl-at-ittipcam/tcS01Alias"
}
```

Invalid or future dates return `400`. If SUNAT is temporarily unavailable, the
endpoint returns `503`.
