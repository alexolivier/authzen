---
title: "COAZ-OpenAPI: COAZ Binding for OpenAPI-Described HTTP APIs - Draft 1"
abbrev: "coaz-openapi"
category: std
date: 2026-09-10
ipr: none

docname: authzen-coaz-openapi-binding-1_0
consensus: true
workgroup: OpenID AuthZEN
keyword:
 - authorization
 - OpenAPI
 - HTTP
 - REST
 - AuthZEN
 - fine-grained authorization
 - API gateway

stand_alone: true
smart_quotes: no
pi: [toc, sortrefs, symrefs, private]

author:
 -
    fullname: Alex Olivier
    organization: Cerbos
    email: alex@cerbos.dev

normative:
  RFC2119:
  RFC8174:
  RFC7519:
  RFC9110:
  RFC9457:
  AUTHZEN:
    title: "Authorization API 1.0"
    target: https://openid.net/specs/authorization-api-1_0.html
    author:
      -
        name: Omri Gazitt
        org: Aserto
      -
        name: David Brossard
        org: Axiomatics
      -
        name: Atul Tulshibagwale
        org: SGNL
    date: 2026
  COAZFW:
    title: "COAZ: A Framework for Mapping Information Models to AuthZEN Authorization Requests"
    target: https://openid.net/specs/authzen-coaz-framework-1_0.html
    author:
      -
        name: Alex Olivier
        org: Cerbos
      -
        name: Atul Tulshibagwale
        org: SGNL
    date: 2026
  OPENAPI:
    title: "OpenAPI Specification"
    target: https://spec.openapis.org/oas/latest.html
    author:
      -
        name: OpenAPI Initiative
    date: 2025
  CEL:
    title: "Common Expression Language"
    target: https://cel.dev/
    author:
      -
        name: Google
    date: 2024

informative:
  RFC6750:
  RFC7662:
  RFC8707:
  RFC9111:
  COAZMCP:
    title: "COAZ-MCP: COAZ Binding for the Model Context Protocol"
    target: https://openid.net/specs/authzen-coaz-mcp-binding-1_0.html
    date: 2026
  OAUTH21:
    title: "The OAuth 2.1 Authorization Framework"
    target: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12
    date: 2024
  FETCH:
    title: "Fetch Standard"
    target: https://fetch.spec.whatwg.org/
    author:
      -
        name: WHATWG
    date: 2025

--- abstract

This specification defines COAZ-OpenAPI, the COAZ binding — as defined by the
COAZ Framework {{COAZFW}} — for HTTP APIs described by an OpenAPI document
{{OPENAPI}}. It defines how an HTTP request, matched to an operation in an
OpenAPI document, is mapped into a request to the OpenID AuthZEN Authorization
API {{AUTHZEN}}, enabling API gateways and API servers to perform fine-grained,
parameter-level authorization through an AuthZEN Policy Decision Point (PDP).
The binding defines a fixed *default mapping* that authorizes any matched
operation from its HTTP method and route without per-operation configuration,
and allows the author of an OpenAPI document to override the default for a
specific operation by *declaring* a mapping on that operation using Common
Expression Language (CEL) {{CEL}}. Because the mapping is carried in the
OpenAPI document itself, any party holding the document — an API gateway, the
API server, or an API client — can see how each operation will be authorized.

--- middle

# Introduction

The OpenAPI Specification {{OPENAPI}} is the predominant way of describing HTTP
{{RFC9110}} APIs: their paths, operations, parameters, request bodies, and
security requirements. Authentication for such APIs is typically handled by
OAuth 2.0 or OpenID Connect, which OpenAPI describes through its Security
Scheme Objects. OAuth alone, however, leaves some concerns unaddressed:

- An access token may carry scopes, but whether a given call is permitted
  depends on the specific resource it targets — the report, the account, the
  customer identified by a path parameter or a body field — and on dynamic,
  fine-grained policy that scopes cannot express.

- An API gateway enforcing authorization for many APIs usually has no
  knowledge of any one API's business semantics. It can see that a request is
  a `POST` to `/expense-reports/{id}/approve`, but not that this is an
  `approve` action on an `expense_report`, nor which fields of the request
  identify the resource.

The OpenID AuthZEN Authorization API {{AUTHZEN}} provides standardized,
fine-grained authorization using the Subject-Action-Resource-Context (SARC)
model. The COAZ Framework {{COAZFW}} defines, in a protocol-neutral way, how to
project the information model of a protocol into an AuthZEN Authorization API
request. This specification is COAZ-OpenAPI, the COAZ *binding* for
OpenAPI-described HTTP APIs: it binds that framework to the information model
of an HTTP request interpreted through an OpenAPI document.

This binding authorizes **every request that matches an operation** in the
OpenAPI document and requires authentication. It does so by defining a single
default mapping, derived from the HTTP method and the matched route
({{default-mapping}}), which a PEP applies unless the OpenAPI document declares
a more specific mapping for the matched operation ({{declared-mappings}}).

## Requirements Notation and Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
document are to be interpreted as described in BCP 14 {{RFC2119}} {{RFC8174}}
when, and only when, they appear in all capitals, as shown here.

## Terminology

This specification uses the terms defined in the COAZ Framework {{COAZFW}} —
notably *binding*, *information model*, *input variable*, *mapping*, *literal*,
*expression*, *default mapping*, *declared mapping*, *PEP*, and *PDP* — and the
terms *OpenAPI Document*, *Paths Object*, *Path Item Object*, *Operation
Object*, *Parameter Object*, *Security Requirement Object*, and *Specification
Extension* as defined in {{OPENAPI}}. It adds the following:

API Client:
: The party that sends an HTTP request to the API. In OAuth terms it is the
  client application; it may act on behalf of a human user, or autonomously.

API Server:
: The HTTP server that implements the operations described by the OpenAPI
  document.

API Gateway:
: An *optional* intermediary between API clients and one or more API servers.
  Where present, a gateway MAY act as the PEP on behalf of the API server.

Operation:
: A single HTTP method on a single path, described by an Operation Object in
  the OpenAPI document. Each operation is a COAZ *operation* in the sense of
  {{COAZFW}}: a unit of work requiring an independent authorization decision.

Matched Operation:
: The operation in the OpenAPI document that an incoming HTTP request resolves
  to ({{matching}}).

Effective Security Requirement:
: The list of Security Requirement Objects that applies to an operation: the
  Operation Object's `security` if present, otherwise the OpenAPI document's
  top-level `security`, otherwise empty.

COAZ:
: Compatible with OpenID AuthZEN (pronounced "cozy"). The framework {{COAZFW}}
  of which this specification is a binding.

# Relationship to the COAZ Framework {#framework-conformance}

This binding fulfils the binding conformance requirements of the COAZ Framework
{{COAZFW}} as summarized below; each row is specified in the referenced section.

| Framework requirement | This binding |
|:---|:---|
| Information model | `request`, `operation`, `token` ({{information-model}}) |
| Mapping location | `x-authzen-mapping` in the matched Operation Object; otherwise the default mapping ({{declaring-support}}, {{default-mapping}}) |
| Literal/expression discriminator | framework default: `$` prefix, `$$` escape ({{expressions}}) |
| Expression language | framework default: Common Expression Language {{CEL}} ({{expressions}}) |
| Envelopes | `evaluation` and `evaluations` ({{mapping-envelopes}}) |
| Operations in scope | Every operation in the OpenAPI document that requires authentication; pass-through set listed ({{default-mapping}}) |
| Default mapping behavior | A single default mapping over method and route, applied to every in-scope operation ({{default-mapping}}) |
| Declared mapping behavior | The OpenAPI document author MAY declare a mapping on an operation; it overrides the default for that operation ({{declared-mappings}}) |
| Trust-anchored fields | `subject.id` SHOULD be anchored to the subject-identity claim; when it is, it is enforced by verification against `$token.sub`, and a mapping MAY override its source for edge cases ({{declared-mappings}}) |
| Error transport | HTTP status codes with Problem Details {{RFC9457}} bodies ({{error-handling}}) |
| Discoverability | Declared mappings are carried in the published OpenAPI document ({{declaring-support}}) |

## Architecture

The OpenAPI document describes every operation of the API and, for operations
that declare a mapping, carries the `x-authzen-mapping` within the Operation
Object. Because the mapping travels in the document, it reaches every party
that holds the document, and any of them can act as the PEP. This binding
supports both deployment shapes:

- **Gateway as PEP.** Where an API gateway sits between clients and servers, it
  is configured with — or fetches from the API server — the OpenAPI document,
  exactly as it would to perform request validation or routing. From that same
  document it obtains each operation's declared mapping, with no additional
  configuration. This is what lets a gateway — often operated by a platform or
  IT team with no knowledge of a specific API's business logic — enforce
  authorization that the API owner defined: the OpenAPI document declares *how*
  its operations are to be authorized, and the gateway enforces it.

- **Server as PEP.** Where no gateway is present, the API server enforces its
  own declared mappings, and the default mapping for everything else, calling
  the PDP directly — typically from middleware generated from, or driven by,
  the same OpenAPI document.

In both shapes, publishing the OpenAPI document also makes the mappings
available to API clients, so that a client — human-authored or an AI agent
consuming the document as a tool description — can understand how a call will
be authorized and shape its request accordingly.

When an HTTP request is processed, the PEP — the API gateway or the API server
itself — matches the request to an operation, selects the applicable mapping
(declared, if present on that operation; otherwise the default mapping),
constructs the corresponding AuthZEN request, and calls the PDP before allowing
the request to reach the operation's implementation.

~~~ ascii-art
+-------------+      +-------------+        +-------------+      +-------------+
| API Client  |      | API Gateway |        | API Server  |      | AuthZen PDP |
+-------------+      +-------------+        +-------------+      +-------------+
       |                    |                      |                    |
       |                    |  1. OpenAPI document |                    |
       |                    |  (configured, or     |                    |
       |                    |   fetched from the   |                    |
       |                    |   server) incl. any  |                    |
       |                    |   x-authzen-mapping  |                    |
       |                    +<---------------------+                    |
       |                    |                      |                    |
       |  2. HTTP request   |   3. authorize       |                    |
       +------------------->+----------------------+------------------->|
       |                    |                      |   permit / deny    |
       |                    +<---------------------+--------------------+
       |                    |  4. forward request  |                    |
       |                    +--------------------->|  (5. server MAY    |
       |                    |                      |   re-authorize)    |
       |                    |   6. HTTP response   |                    |
       |  6. HTTP response  +<---------------------+                    |
       +<-------------------+                      |                    |
       v                    v                      v                    v
~~~
{: #fig-coaz-architecture title="COAZ enforcement for OpenAPI-described HTTP requests"}

Steps 3 and 5 are alternatives. If a gateway acts as the PEP it calls the PDP;
otherwise the server does. It is possible, but redundant, for both to call the
PDP.

# Information Model {#information-model}

This binding exposes three input variables to expressions:

`request`:
: A map describing the HTTP request being authorized, interpreted through the
  matched operation's definition in the OpenAPI document. It has the following
  members:

  `method`:
  : The request method token {{RFC9110}}, as received (e.g. `GET`, `POST`).

  `path`:
  : The path component of the request target, as received, after the
    normalization applied for matching ({{matching}}) — e.g.
    `/customers/cust-12345`.

  `path_params`:
  : A map from the name of each path parameter declared by the matched
    operation (or its Path Item Object) to its value, extracted from the
    request path according to the operation's path template and deserialized
    per the corresponding Parameter Object.

  `query`:
  : A map from query parameter name to value. Parameters declared by the
    matched operation are deserialized per their Parameter Object; undeclared
    parameters are exposed as strings, or as a list of strings where a name is
    repeated.

  `headers`:
  : A map from header field name, lower-cased, to value. Header parameters
    declared by the matched operation are deserialized per their Parameter
    Object; other headers are exposed as strings, with multiple instances of a
    field combined as {{RFC9110}} permits. The PEP MUST omit credential-bearing
    fields — at minimum `authorization` and `proxy-authorization` — from this
    map (see {{security-considerations}}).

  `cookies`:
  : A map from cookie name to value, deserialized for cookie parameters
    declared by the matched operation. The PEP SHOULD omit cookies used to
    carry a session credential.

  `body`:
  : The request body, when present and parseable. For a body whose media type
    is `application/json` or ends in `+json`, this is the parsed JSON value.
    For `application/x-www-form-urlencoded` the PEP SHOULD expose a map from
    field name to string value. For any other media type, and when the request
    carries no body, `body` is absent.

  Fields are accessed using standard CEL field or index notation (e.g.
  `request.method`, `request.path_params.customer_id`,
  `request.query.expand`, `request.headers["x-tenant-id"]`,
  `request.body.amount`).

`operation`:
: A map describing the matched operation in the OpenAPI document:

  `path`:
  : The path template that the request matched — the key of the Paths Object,
    e.g. `/customers/{customer_id}`.

  `id`:
  : The `operationId` of the matched Operation Object, if one is defined;
    otherwise absent.

  `tags`:
  : The `tags` of the matched Operation Object, as a list of strings; an empty
    list if none are defined.

`token`:
: A map corresponding to the complete set of validated claims of the OAuth
  access token used to authorize the request. For a JWT-formatted {{RFC7519}}
  token these are its decoded claims; for an opaque token they are the claims
  returned by token introspection {{RFC7662}}. All claims are available,
  including but not limited to `sub`, `iss`, `aud`, `exp`, `scope`, and
  `client_id`. Claims are accessed using standard CEL field or index notation
  (e.g. `token.sub`, `token.aud`, `token.client_id`).

This binding defines how `token` is populated for the `oauth2`,
`openIdConnect`, and `http` (`bearer`) Security Scheme types of {{OPENAPI}}. A
PEP MAY populate `token` from another scheme type — for example, by resolving
an `apiKey` to a set of claims — by deployment-specific means, in which case
the claim used as the subject-identity claim ({{subject-identity-claim}}) MUST
be identified by that deployment.

## Request Matching {#matching}

Before any mapping can be selected, the PEP MUST resolve the incoming request
to exactly one operation in the OpenAPI document:

1. Normalize the request target's path: resolve dot-segments and, where the
   document's Server Objects declare a base path, remove the base path of the
   server the request was received on.

2. Match the resulting path against the keys of the Paths Object using the
   path templating rules of {{OPENAPI}}. A concrete path takes precedence over
   a templated path that would also match.

3. Select the Operation Object for the request method within the matched Path
   Item Object.

The resulting Operation Object is the matched operation. A request whose path
matches no Path Item, whose method has no Operation Object in the matched Path
Item, or whose match is ambiguous, is an unmatched request and is handled as
specified in {{unmatched-requests}}.

The values of `request.path_params`, `request.query`, `request.headers`, and
`request.cookies` are derived from the matched operation's Parameter Objects,
including those inherited from the Path Item Object.

## The Subject-Identity Claim {#subject-identity-claim}

The AuthZEN `subject` identifies the principal on whose behalf authorization is
requested. Throughout this binding, `subject.id` is derived from a single token
claim, the **subject-identity claim**, which by convention is `sub` — hence the
expression `$token.sub` used in the mappings below.

Where an access token is issued with a client or agent as the principal (so
`sub` identifies the *application*, not the human user on whose behalf it
acts), a deployment MAY designate a different claim — an on-behalf-of claim —
as the subject-identity claim, so that `subject.id` carries the human user.
When a deployment designates an on-behalf-of claim `C`, every use of
`$token.sub` as `subject.id` in this binding (in the default mapping, in
declared mappings, and in the verification of {{declared-mappings}}) is read as
`$token.C`. The client identity remains in `context.client` (typically
`$token.?client_id`) regardless. The designated claim MUST be agreed between
the PEP and the token issuer; absent any designation, the subject-identity
claim is `sub`.

# Expressions and Literals {#expressions}

This binding uses the framework's defaults unchanged ({{COAZFW}}): expressions
are written in Common Expression Language {{CEL}}, and the leading-`$`
discriminator with its `$$` escape distinguishes them from literals. A string
value beginning with `$` is a CEL expression evaluated against the `request`,
`operation`, and `token` input variables (e.g., `$token.sub`,
`$request.path_params.customer_id`,
`$request.body.amount > 10000 ? 'high' : 'standard'`); any other value is a
literal, used verbatim (e.g., the string `customer`, the number `10`, the
boolean `true`); `$$50` denotes the literal string `$50`. Within an
expression, ordinary CEL syntax applies, including CEL's own single-quoted
string literals.

Per the COAZ expression contract ({{COAZFW}}), a CEL expression MUST evaluate
to a single JSON value — a scalar, list, or map. A list or map returned by an
expression is a single field value and does not, by itself, produce multiple
evaluations. To populate an OPTIONAL field from a claim or parameter that may
be absent, an expression MUST use CEL optional selection (the `.?` operator,
e.g. `$token.?client_id` or `$request.query.?expand`), which omits the field
from the request when the key is missing; plain field selection on a missing
key is an evaluation error.

An expression whose evaluation results in an error, or that yields absent or
null for a REQUIRED field (`subject`, `action`, or `resource`), is a mapping
error ({{mapping-errors}}). Every mapping in this binding — including the
default mapping — contains CEL expressions, so a conforming PEP MUST include a
CEL evaluator; there is no expression-free conformance level.

The following example illustrates how the input variables are populated. Given
an OpenAPI document containing:

~~~ yaml
paths:
  /customers/{customer_id}:
    get:
      operationId: getCustomer
      tags: [customers]
      parameters:
        - name: customer_id
          in: path
          required: true
          schema: { type: string }
        - name: case
          in: query
          schema: { type: string }
~~~
{: #fig-openapi-fragment title="Example operation in an OpenAPI document"}

and the HTTP request:

~~~ http
GET /customers/cust-12345?case=case-67890 HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJ...
~~~
{: #fig-http-request title="Example HTTP request"}

with an access token whose validated claims are:

~~~ json
{
  "sub": "alice@example.com",
  "client_id": "https://apps.example.com/expense-portal",
  "iss": "https://auth.example.com",
  "aud": "https://api.example.com",
  "exp": 1750000000
}
~~~
{: #fig-token-claims title="Example validated access token claims"}

expressions resolve as follows:

| Expression | Resolved value |
|:---|:---|
| `$request.method` | `"GET"` |
| `$request.path` | `"/customers/cust-12345"` |
| `$request.path_params.customer_id` | `"cust-12345"` |
| `$request.query.case` | `"case-67890"` |
| `$operation.path` | `"/customers/{customer_id}"` |
| `$operation.id` | `"getCustomer"` |
| `$token.sub` | `"alice@example.com"` |
| `$token.?client_id` | `"https://apps.example.com/expense-portal"` |
| `customer` | `"customer"` (literal) |
{: #fig-cel-resolution title="Expression and literal resolution"}

# Mapping Envelopes {#mapping-envelopes}

As defined by the COAZ Framework ({{COAZFW}}), a mapping is a JSON object with
a single top-level member — its envelope — whose key names the AuthZEN API to
call. This binding permits both envelope keys defined by the framework:

- `evaluation` — a template for a single-decision Access Evaluation request.
  The default mapping uses this envelope ({{default-mapping}}), and it is the
  RECOMMENDED envelope for declared mappings that require one decision.

- `evaluations` — a template for a multi-decision Access Evaluations request,
  for operations whose single invocation requires more than one decision (see
  {{fig-coaz-multi}}).

A mapping whose top-level structure is anything other than exactly one of these
two keys is malformed, and the PEP MUST treat it as a mapping error
({{mapping-errors}}).

A PDP used with this binding MUST support the Access Evaluation API. Where a
declared mapping uses the `evaluations` envelope, the PEP MUST either send the
constructed request to the Access Evaluations API or, if its PDP does not
support that API, issue one Access Evaluation request per entry — applying the
top-level defaults to each entry exactly as {{AUTHZEN}} defines — and allow the
request only if every decision is a permit.

# Declaring a Mapping {#declaring-support}

The author of an OpenAPI document declares a mapping for an operation by
including an `x-authzen-mapping` Specification Extension in that operation's
Operation Object. The presence of `x-authzen-mapping` indicates the operation
carries a declared mapping; its absence means the default mapping applies. No
separate marker field is used. Within a YAML-serialized document the mapping
is written in YAML; it is interpreted as the equivalent JSON object.

This binding defines `x-authzen-mapping` only on the Operation Object. A PEP
MUST ignore an `x-authzen-mapping` that appears at any other location in the
document, such as a Path Item Object or the document root.

Because the declared mapping is carried in the OpenAPI document, it is
available to any API gateway configured with the document — which can
therefore enforce it as the PEP without further configuration
({{framework-conformance}}) — and to any API client that obtains the document,
satisfying the framework's discoverability capability. Where an API publishes
its OpenAPI document at a well-known or documented URL, the mappings are
discoverable at that URL.

The following non-normative example shows an OpenAPI document with one
operation that declares a mapping and one that does not:

~~~ yaml
openapi: 3.1.0
info:
  title: Customer Service
  version: 1.0.0
servers:
  - url: https://api.example.com
security:
  - oauth: [customers.read]
components:
  securitySchemes:
    oauth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          scopes:
            customers.read: Read customer records
paths:
  /customers/{customer_id}:
    get:
      operationId: getCustomer
      summary: Get customer details
      parameters:
        - name: customer_id
          in: path
          required: true
          schema: { type: string }
        - name: case
          in: query
          description: The case being worked on
          schema: { type: string }
      x-authzen-mapping:
        evaluation:
          subject: { type: identity, id: "$token.sub" }
          action: { name: get_customer }
          resource: { type: customer, id: "$request.path_params.customer_id" }
          context: { client: "$token.?client_id", case: "$request.query.?case" }
      responses:
        "200": { description: The customer }
  /weather:
    get:
      operationId: getLocalWeather
      summary: Get weather for the local area
      parameters:
        - name: zip
          in: query
          required: true
          schema: { type: string }
      responses:
        "200": { description: The forecast }
~~~
{: #fig-openapi-declared title="Example OpenAPI document with a declared mapping"}

`getCustomer` declares a mapping; `getLocalWeather` does not and is therefore
authorized by the default mapping ({{default-mapping}}).

# Default Mapping {#default-mapping}

This binding defines a single default mapping. A PEP MUST apply it to every
request that matches an in-scope operation, unless that operation declares a
mapping ({{declared-mappings}}).

The default mapping uses the `evaluation` envelope ({{mapping-envelopes}}). It
takes the HTTP method as the action, the matched route as the resource, and
carries the concrete path and path parameters as resource properties, so that
policy written against the default mapping can reason about both the route
(`GET /customers/{customer_id}`) and the specific resource instance it
targets:

~~~ json
{
  "evaluation": {
    "subject": { "type": "identity", "id": "$token.sub" },
    "action": { "name": "$request.method" },
    "resource": {
      "type": "http_route",
      "id": "$operation.path",
      "properties": {
        "path": "$request.path",
        "path_params": "$request.path_params"
      }
    },
    "context": { "client": "$token.?client_id" }
  }
}
~~~
{: #fig-default-mapping title="The default mapping"}

Applied to the request and token of {{fig-http-request}} and
{{fig-token-claims}} for an operation with no declared mapping, the default
mapping produces:

~~~ json
{
  "subject": { "type": "identity", "id": "alice@example.com" },
  "action": { "name": "GET" },
  "resource": {
    "type": "http_route",
    "id": "/customers/{customer_id}",
    "properties": {
      "path": "/customers/cust-12345",
      "path_params": { "customer_id": "cust-12345" }
    }
  },
  "context": { "client": "https://apps.example.com/expense-portal" }
}
~~~
{: #fig-default-result title="Access Evaluation request produced by the default mapping"}

The resource identifier is the path *template* rather than the concrete path.
The template is stable across resource instances, so a single policy rule can
govern an operation, while the concrete path and the extracted parameters
remain available under `properties` for rules that depend on the instance.
Request bodies, query parameters, and headers are deliberately not projected
by the default mapping; an operation whose authorization depends on them
SHOULD declare a mapping ({{declared-mappings}}), and deployments SHOULD note
the consequences described in {{security-considerations}}.

## Operations in Scope

An operation is in scope when it *requires authentication*: its effective
security requirement is non-empty and contains no empty Security Requirement
Object. Every request that matches an in-scope operation MUST be authorized by
the applicable mapping.

## Pass-through Operations {#pass-through}

The following are pass-through: the PEP MUST NOT call the PDP for them and MUST
allow them to proceed. They are listed explicitly so that the absence of a
mapping is never interpreted as a deny.

- Requests that match an operation which does not require authentication —
  one whose effective security requirement is empty, or lists an empty
  Security Requirement Object — and that carry no access token. If such a
  request does carry an access token that validates, the PEP MUST authorize it
  as it would any in-scope request.

- CORS preflight requests {{FETCH}}: `OPTIONS` requests carrying an
  `Access-Control-Request-Method` header field. These are issued by browsers
  without credentials and precede the request that this binding authorizes.

A PEP SHOULD log, at deployment time, the operations that are pass-through
because the document declares no security requirement for them, so that an
OpenAPI document that omits `security` altogether does not silently yield an
unauthorized API (see {{security-considerations}}).

## Unmatched Requests {#unmatched-requests}

A request that does not resolve to exactly one operation ({{matching}}) has no
applicable mapping. The PEP MUST NOT allow it to proceed and MUST refuse it
with `404 (Not Found)` where no Path Item matched, or `405 (Method Not
Allowed)` — with an `Allow` header field listing the methods the Path Item
does define — where a Path Item matched but defines no operation for the
method. This ensures that requests to routes absent from the document fail
closed rather than bypassing authorization. A PEP MAY instead respond with
`403 (Forbidden)` where a deployment prefers not to disclose which routes
exist.

# Declared Mappings {#declared-mappings}

The author of an OpenAPI document MAY declare a mapping for an operation by
including `x-authzen-mapping` in the Operation Object ({{declaring-support}}).
A declared mapping has the same shape as the default mapping — an envelope
naming the AuthZEN API and a template for that API's request body
({{mapping-envelopes}}) — and uses the same expression and literal rules
({{expressions}}). A declared mapping MAY use either the `evaluation` or the
`evaluations` envelope: `evaluation` suffices for most operations, while
`evaluations` serves operations whose single invocation requires multiple
decisions.

A declared mapping for an operation **overrides the default mapping for that
operation only**. It does not affect any other operation, including other
methods on the same path.

The subject identifier (`subject.id`) SHOULD be anchored to the subject-identity
claim of the validated access token. A declared mapping SHOULD include a
`subject` — the request's `subject` under the `evaluation` envelope, or the
top-level `subject` under the `evaluations` envelope — whose `id` is set to an
expression resolving to the subject-identity claim ({{subject-identity-claim}})
— that is, `$token.sub` (or `$token.C` where an on-behalf-of claim `C` is
designated). Where `subject.id` is set to the subject-identity claim, the PEP
MUST verify that its resolved value equals that claim in the validated access
token, treating a mismatch as a mapping error ({{mapping-errors}}); this is the
trust-anchored, verification-enforced case defined by the COAZ Framework
({{COAZFW}}), and it prevents the OpenAPI document — authored by the API owner,
the party being authorized — from asserting the identity of a different
subject, for example by mapping `subject.id` from a caller-controlled header.

Some deployments cannot convey the subject identity in a token claim — for
example, an agentic deployment whose access token is issued to the agent while
the identity of the acting user is carried outside the token. For these edge
cases a declared mapping MAY override `subject.id` with a value derived from
elsewhere in the operation's inputs; because full override via a CEL expression
is already available, any field of the incoming request — token claim, header,
path or query parameter, body field, or otherwise — can be mapped to
`subject.id`. An overridden `subject.id` SHOULD still be derived from the
validated token rather than from caller-controlled request fields. When a
declared mapping sets `subject.id` from a source the PEP cannot verify against
a token claim, the subject identity is asserted by the mapping author rather
than anchored to the token; a PEP — particularly a gateway enforcing a mapping
authored by the API owner — SHOULD emit a warning in this case, and deployments
SHOULD account for the additional trust this places in the mapping author (see
{{security-considerations}}).

If a declared mapping omits `subject` or `subject.id`, the PEP MUST supply the
default subject identifier, `$token.sub` (or `$token.C`), so that every request
still carries a token-anchored subject.

To close off identity smuggling, a declared mapping using the `evaluations`
envelope MUST NOT set `subject` within any entry of its `evaluations` array;
the single top-level `subject` applies to all evaluations. A PEP MUST reject a
declared mapping that places `subject` inside an `evaluations` entry as a
mapping error.

A declared mapping MAY otherwise shape the `subject`: it MAY set
`subject.type` and additional subject attributes (under `properties`, per
{{AUTHZEN}}), so that different requests can produce different subject objects.
If a declared mapping omits `subject.type`, the PEP MUST supply `identity`. Any
subject attribute other than `subject.id` — including `subject.type` — is
untrusted input, exactly like declared `action`, `resource`, and `context`
attributes; only the verified `subject.id` is trustworthy as the authenticated
identity. See {{security-considerations}}.

Where the API is called by autonomous agents or by applications acting on a
user's behalf, the `context` SHOULD include the client identity (typically
`$token.?client_id`), so that policy can evaluate the user and the calling
application independently.

## Single-evaluation Example

The declared mapping for `getCustomer` in {{fig-openapi-declared}} uses the
`evaluation` envelope. Applied to the request and token in {{fig-http-request}}
and {{fig-token-claims}}, it produces the following Access Evaluation request,
sent to the Access Evaluation API:

~~~ json
{
  "subject": { "type": "identity", "id": "alice@example.com" },
  "action": { "name": "get_customer" },
  "resource": { "type": "customer", "id": "cust-12345" },
  "context": { "client": "https://apps.example.com/expense-portal", "case": "case-67890" }
}
~~~
{: #fig-authzen-single title="Resulting Access Evaluation request (single decision)"}

## Multi-evaluation Example

An operation that copies a storage object requires two checks: `read` on the
source, identified by a path parameter, and `write` on the destination,
supplied in the request body. The mapping therefore uses the `evaluations`
envelope: the two checks are entries in the `evaluations` array, and the shared
`subject` and `context` remain at the top level of the request body. As in
every declared mapping, `subject.id` is set to `$token.sub` and verified by the
PEP.

~~~ yaml
paths:
  /objects/{object_id}/copy:
    post:
      operationId: copyObject
      summary: Copy a storage object to another location
      parameters:
        - name: object_id
          in: path
          required: true
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [destination]
              properties:
                destination:
                  type: string
                  description: Destination object location
      x-authzen-mapping:
        evaluations:
          subject: { type: identity, id: "$token.sub" }
          context: { client: "$token.?client_id" }
          evaluations:
            - action: { name: read }
              resource: { type: storage_object, id: "$request.path_params.object_id" }
            - action: { name: write }
              resource: { type: storage_object, id: "$request.body.destination" }
      responses:
        "201": { description: The copied object }
~~~
{: #fig-coaz-multi title="Declared mapping with multiple evaluations"}

For a `POST /objects/reports%2Fq1.pdf/copy` with body
`{"destination": "/bucket/archive/q1.pdf"}`, the resulting Access Evaluations
request, sent to the Access Evaluations API, is:

~~~ json
{
  "subject": { "type": "identity", "id": "alice@example.com" },
  "context": { "client": "https://apps.example.com/expense-portal" },
  "evaluations": [
    { "action": { "name": "read" },
      "resource": { "type": "storage_object", "id": "reports/q1.pdf" } },
    { "action": { "name": "write" },
      "resource": { "type": "storage_object", "id": "/bucket/archive/q1.pdf" } }
  ]
}
~~~
{: #fig-authzen-multi title="Resulting Access Evaluations request (multiple evaluations)"}

## Conditional Expression Example

CEL conditionals and built-ins MAY be used in any expression. A funds-transfer
operation derives values from the request body and token claims, including a
`subject.type` that varies with the caller's roles. The mapping sets
`subject.id` to `$token.sub`, which the PEP verifies against the token
({{declared-mappings}}). Because the declared `subject.type` is untrusted, a
policy that grants elevated access MUST do so on the basis of the verified
`subject.id`, not the declared `subject.type`:

~~~ yaml
paths:
  /transfers:
    post:
      operationId: transferFunds
      summary: Transfer funds between accounts
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [from_account, to_account, amount, currency]
              properties:
                from_account: { type: string }
                to_account:   { type: string }
                amount:       { type: number }
                currency:     { type: string }
      x-authzen-mapping:
        evaluation:
          subject:
            type: "$token.roles.exists(r, r == 'treasury') ? 'treasury_user' : 'standard_user'"
            id: "$token.sub"
          action:
            name: "$request.body.currency == 'USD' ? 'domestic_transfer' : 'international_transfer'"
          resource:
            type: account
            id: "$request.body.from_account"
            properties:
              sensitivity: "$request.body.amount > 10000 ? 'high' : 'standard'"
          context:
            client: "$token.?client_id"
            target_account: "$request.body.to_account"
      responses:
        "202": { description: Transfer accepted }
~~~
{: #fig-coaz-conditions title="Declared mapping using CEL conditional expressions"}

# PEP Behavior {#pep-behavior}

When an HTTP request is processed, the PEP MUST:

1. Apply every rewrite or normalization known to the PEP that can change the
   request method, path, headers, or body — such as base-path stripping, header
   injection, or body transformation — or that can otherwise change mapping
   selection or a value exposed through a binding input variable. The
   resulting request is the evaluated request.

2. Match the evaluated request to an operation ({{matching}}). If no single
   operation matches, refuse the request ({{unmatched-requests}}).

3. If the request is a pass-through operation ({{pass-through}}), allow it
   without calling the PDP.

4. Validate the access token presented with the request. If the operation
   requires authentication and no valid token is presented, refuse the request
   as specified in {{unauthenticated}} without applying any mapping.

5. Select the applicable mapping: if the matched Operation Object carries an
   `x-authzen-mapping`, use the declared mapping; otherwise use the default
   mapping ({{default-mapping}}).

6. Populate `request` from the evaluated request as interpreted through the
   matched operation, `operation` from the matched Operation Object, and
   `token` from the validated access token claims ({{information-model}}).

7. Resolve the mapping: literals verbatim, `$`-prefixed values by evaluating
   the CEL expression ({{expressions}}).

8. Anchor the subject identity: where a mapping sets `subject.id` to the
   subject-identity claim ({{subject-identity-claim}}) — as the default mapping
   does — the effective `subject.id` of every decision in the constructed
   request — the request's `subject` under the `evaluation` envelope; the
   top-level subject and, after any override, the subject of each
   `evaluations` entry under the `evaluations` envelope — MUST equal the value
   of that claim in the validated access token, and the PEP MUST treat a
   mismatch as a mapping error ({{mapping-errors}}) and not call the PDP.
   Where a declared mapping instead overrides `subject.id` from another source
   ({{declared-mappings}}), the PEP cannot perform this verification and SHOULD
   emit a warning. A declared mapping MUST NOT carry a per-evaluation
   `subject`; if one is present, treat the request as a mapping error and do
   not call the PDP.

9. Construct the AuthZEN request from the resolved mapping and send it to the
   API named by the mapping's envelope ({{mapping-envelopes}}): the Access
   Evaluation API for `evaluation`, the Access Evaluations API for
   `evaluations`.

10. Before applying a permit, verify that the request's method, matched
    operation, selected mapping, and input-variable values are semantically
    unchanged from those of the evaluated request. Harmless serialization
    differences — header case, percent-encoding of characters that decode
    identically, or JSON whitespace — do not constitute a change. If any of
    these values changed, the PEP MUST re-evaluate the final request or refuse
    it; it MUST NOT apply the earlier permit to the changed request.

11. Enforce the response: if every decision is `true` (permit), allow the
    request to proceed to the operation; if any decision is `false` (deny), do
    not allow it and return an HTTP error response ({{authorization-denial}}).

A PEP that reads the request body in order to populate `request.body` MUST
make the unmodified body available to the operation after a permit; buffering
and replaying the body is the PEP's responsibility.

# Error Handling {#error-handling}

This binding reports the COAZ denial and error categories ({{COAZFW}}) as HTTP
responses {{RFC9110}}. In every case the PEP MUST NOT allow the request to
proceed to the operation. A response body, when present, SHOULD be a Problem
Details object {{RFC9457}} with media type `application/problem+json`, using
the `type` URIs given below so that clients can distinguish the categories
without parsing free text. A PEP MAY omit the body, or use another format,
where a deployment's error conventions require it; the status codes are
normative regardless.

## Missing or Invalid Credentials {#unauthenticated}

A request to an operation that requires authentication, but that presents no
access token or one that fails validation, is refused before any mapping is
applied. This is not a COAZ category — it is ordinary bearer-token enforcement
— and the PEP MUST respond as {{RFC6750}} specifies: `401 (Unauthorized)`
with a `WWW-Authenticate` header field.

## Mapping Errors {#mapping-errors}

A mapping error occurs when the PEP cannot construct a valid AuthZEN request —
for example, an expression references a missing field, an expression fails to
evaluate, or the mapping is malformed. The PEP MUST respond with
`400 (Bad Request)` where the failure is attributable to the request's inputs
(for instance, a required body field the expression depends on is absent), and
with `500 (Internal Server Error)` where the failure lies in the mapping
itself or cannot be attributed to the request. The `type` SHOULD be
`https://openid.net/authzen/coaz/errors/mapping` and the `detail` SHOULD
describe the failure.

~~~ http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://openid.net/authzen/coaz/errors/mapping",
  "title": "COAZ mapping error",
  "status": 400,
  "detail": "expression '$request.body.region' failed: no such key 'region'"
}
~~~
{: #fig-mapping-error title="HTTP response for a mapping failure"}

## Authorization Denial {#authorization-denial}

A denial is the normal course of policy enforcement, not a fault. When one or
more decisions are deny, the PEP MUST respond with `403 (Forbidden)`. The
`type` SHOULD be `https://openid.net/authzen/coaz/errors/denied`. The
`detail` MAY be populated from an implementation-defined reason conveyed in
the decision `context` of the {{AUTHZEN}} response; note that {{AUTHZEN}} does
not define a standard key for this, so the PEP MUST NOT assume a specific
field name.

~~~ http
HTTP/1.1 403 Forbidden
Content-Type: application/problem+json

{
  "type": "https://openid.net/authzen/coaz/errors/denied",
  "title": "Access denied",
  "status": 403,
  "detail": "insufficient permissions for customer record"
}
~~~
{: #fig-denial-error title="HTTP response for an authorization denial"}

A PEP MAY respond with `404 (Not Found)` instead of `403 (Forbidden)` where a
deployment prefers not to disclose the existence of the targeted resource. A
denial MUST NOT be reported as `401 (Unauthorized)`, which {{RFC6750}} reserves
for missing or invalid credentials.

## PDP Communication Errors {#pdp-errors}

If the PEP cannot reach the PDP or receives an invalid response, it MUST
respond with `503 (Service Unavailable)`, and MAY include a `Retry-After`
header field. The `type` SHOULD be
`https://openid.net/authzen/coaz/errors/pdp-unavailable`.

~~~ http
HTTP/1.1 503 Service Unavailable
Content-Type: application/problem+json
Retry-After: 5

{
  "type": "https://openid.net/authzen/coaz/errors/pdp-unavailable",
  "title": "Authorization service unavailable",
  "status": 503
}
~~~
{: #fig-pdp-error title="HTTP response for a PDP communication failure"}

Responses in every category above are specific to the request that produced
them and MUST NOT be served from or stored in a shared cache; the PEP SHOULD
set `Cache-Control: no-store` {{RFC9111}} on them.

# Security Considerations

## Token Integrity

The access token referenced by the `token` input variable MUST be validated by
the PEP before its claims are used. For a JWT the PEP MUST verify the token
signature, issuer, audience, and expiration in accordance with {{RFC7519}} and
the OAuth framework in use; for an opaque token it MUST obtain the claims from
a trusted introspection endpoint {{RFC7662}} over a protected channel. Correct
audience validation and resource-indicator binding {{RFC8707}} are essential
where a single authorization server issues tokens for many APIs.

## Subject Identity

The subject identifier (`subject.id`) SHOULD be anchored to the subject-identity
claim of the validated access token. The default mapping sets it to `$token.sub`,
and where a declared mapping sets it to the subject-identity claim the PEP
verifies that the resolved value equals the subject of the validated access
token, rejecting any mismatch ({{declared-mappings}}). This verification is
essential where the PEP is an API gateway and the declared mapping is authored
by the API owner: without it, the document could map `subject.id` from any
request field — a header, a query parameter, a body field — and thereby obtain
a decision for a user the caller never authenticated as, since every such field
is under the caller's control.

This binding uses SHOULD rather than MUST so that agentic deployments whose
acting-user identity is not carried in a verifiable token claim can still map a
`subject.id` ({{declared-mappings}}). This flexibility is a deliberate trade-off:
a `subject.id` that the PEP cannot verify against a token claim is only as
trustworthy as the mapping author and the source it is drawn from. Deployments
SHOULD prefer token-anchored subject identities, SHOULD surface a warning when a
mapping overrides `subject.id` from an unverifiable source, and MUST weigh, in
their threat model, the trust placed in whoever authored such a mapping. Where
the PEP is a gateway enforcing a mapping authored by a less-trusted API owner,
an unverifiable `subject.id` SHOULD NOT be relied upon as an authenticated
identity.

## Untrusted Declared-Mapping Attributes

A declared mapping is supplied by the author of the OpenAPI document, which
describes the operation being authorized. Every attribute it produces —
`action`, `resource`, `context`, and all subject attributes other than the
verified `subject.id`, including `subject.type` — is untrusted input to the
PDP. Moreover, most of the values a mapping projects originate from the HTTP
request, which is under the caller's control: a header, query parameter, or
body field is exactly as trustworthy as the caller. PDP policies MUST NOT treat
an attribute that originates from a declared mapping as authoritative for
identity or privilege; for example, a policy MUST NOT grant access on the basis
of a `subject.type` or `context` attribute that the mapping could set from a
request header. The trustworthy authorization inputs are the verified
`subject.id`, other validated token claims, and any attributes the PDP itself
obtains from trusted sources.

## Credential Exposure Through the Information Model

The `request.headers` and `request.cookies` maps expose caller-supplied fields
to expressions, and any value an expression projects is transmitted to the PDP
and may be logged or persisted there. The PEP MUST omit `authorization` and
`proxy-authorization` from `request.headers` and SHOULD omit cookies carrying a
session credential, so that a mapping cannot — deliberately or by accident —
forward the caller's credential to the PDP. Mapping authors SHOULD project only
the fields on which authorization actually depends.

## Document Integrity and Provenance

The OpenAPI document determines how every operation is authorized. A PEP MUST
obtain it from a trusted source — its own configuration, or an endpoint of the
API server reached over a protected channel — and SHOULD validate that each
declared mapping is well-formed and that its expressions reference only
defined input variables before relying on it. A gateway that fetches the
document from the API server at runtime places the same trust in the server as
an MCP gateway places in a `tools/list` response ({{COAZMCP}}); the trust
placed in the API owner as the author of declared mappings MUST be considered
in the deployment's threat model. A change to the document changes
authorization behavior and SHOULD be subject to the same review as a change to
policy.

## Documents Without Security Requirements

This binding treats an operation with no effective security requirement as
pass-through ({{pass-through}}), because the OpenAPI document is the
authority on which operations require authentication. An OpenAPI document that
omits `security` — whether by design or by oversight — therefore yields an API
on which no AuthZEN authorization occurs. Deployments MUST verify that every
operation intended to be protected carries a security requirement, and a PEP
SHOULD make the set of pass-through operations visible at deployment time.

## Request Body Handling

Populating `request.body` requires the PEP to read and parse the body before
the operation does. A PEP MUST bound the size of the body it will buffer and
parse, and MUST treat a body that exceeds that bound or that fails to parse as
a mapping error rather than proceeding with a partial value, so that an
oversized or malformed body cannot cause the authorization decision to be made
on inputs that differ from those the operation will act on.

## Authorization Granularity and Omitted Inputs

An AuthZEN decision applies to the request constructed by the selected mapping.
Two HTTP requests that differ only in an input the mapping does not project —
for the default mapping, any query parameter, header, or body field — can
therefore construct the same AuthZEN request and receive the same decision.
This can be intentional for a coarse-grained mapping, but the omitted input is
not thereby evaluated by the PDP.

For every input on which authorization is intended to depend, the mapping MUST
project that input into the AuthZEN request or the deployment MUST enforce the
same condition independently. A PEP MUST NOT represent a permit as evidence
that the PDP evaluated an omitted input. The operation-binding check in
{{pep-behavior}} prevents a permit from being transplanted onto a changed
request after evaluation; it does not make omitted inputs
authorization-relevant.

## Fail-Closed Enforcement

As required by the framework, the PEP MUST fail closed: a mapping error, a
denial, a PDP communication failure, and an unmatched request all result in
the request being refused.

## Transport Security

All communication between the PEP and the PDP MUST use TLS, as specified in the
transport requirements of {{AUTHZEN}}.

## Deployment Coverage

Implementers SHOULD ensure that at least one COAZ-aware PEP in the deployment
path authorizes each in-scope request. If no PEP processes the mapping, no
AuthZEN authorization occurs and access control falls back to other mechanisms.

# IANA Considerations

This specification has no IANA actions. The `x-authzen-mapping` Specification
Extension is defined by this document in accordance with the extension
mechanism of {{OPENAPI}}, which requires no registration.

--- back

# Relationship to Other Specifications

## COAZ Framework

This specification is a binding of the COAZ Framework {{COAZFW}}. The framework
defines the protocol-neutral model — mappings shaped as AuthZEN Access
Evaluation or Access Evaluations requests, the literal/expression distinction,
the expression contract, and the conformance requirements. This binding binds
that model to the information model of an HTTP request interpreted through an
OpenAPI document, and to HTTP as the error transport.

## COAZ-MCP

COAZ-MCP {{COAZMCP}} is the sibling binding for the Model Context Protocol.
The two bindings share the same mapping shape, expression language, envelope
keys, and trust-anchoring rules, and use the same `x-authzen-mapping` key in
the schema that describes the operation — a tool's `inputSchema` in MCP, an
Operation Object here. An API exposed both as an MCP server and as an
OpenAPI-described HTTP API can therefore be authorized by the same policy in
both shapes, provided the mappings project the same action and resource
values.

## OpenID AuthZEN Authorization API

The constructed request and the decision response are defined by {{AUTHZEN}}.
This binding uses the Access Evaluation API for single-decision mappings —
including the default mapping — and the Access Evaluations API where a
declared mapping requires multiple decisions ({{mapping-envelopes}}).

## OpenAPI Specification

This binding extends the OpenAPI {{OPENAPI}} Operation Object with the
`x-authzen-mapping` Specification Extension. It is backward compatible: tooling
that does not understand the extension ignores it, as {{OPENAPI}} requires for
any `x-` field, and the default mapping still allows a PEP to authorize every
operation of an unmodified document.

## OAuth 2.1

This binding complements OAuth 2.1 {{OAUTH21}} and bearer token usage
{{RFC6750}}. OAuth provides authentication and coarse-grained authorization via
scopes; this binding enables fine-grained, parameter-level decisions that
consider the specific resources and context of each request.

# Acknowledgements

The author would like to thank the members of the OpenID AuthZEN Working
Group for their ongoing work on the Authorization API standard, and the
contributors to the COAZ Framework and COAZ-MCP binding, whose structure this
binding follows.

# Notices

Copyright (c) 2026 The OpenID Foundation.

The OpenID Foundation (OIDF) grants to any Contributor, developer, implementer,
or other interested party a non-exclusive, royalty free, worldwide copyright license to
reproduce, prepare derivative works from, distribute, perform and display, this
Implementers Draft, Final Specification, or Final Specification Incorporating Errata
Corrections solely for the purposes of (i) developing specifications, and (ii)
implementing Implementers Drafts, Final Specifications, and Final Specification
Incorporating Errata Corrections based on such documents, provided that attribution
be made to the OIDF as the source of the material, but that such attribution does not
indicate an endorsement by the OIDF.

The technology described in this specification was made available from contributions
from various sources, including members of the OpenID Foundation and others.
Although the OpenID Foundation has taken steps to help ensure that the technology
is available for distribution, it takes no position regarding the validity or scope of any
intellectual property or other rights that might be claimed to pertain to the
implementation or use of the technology described in this specification or the extent
to which any license under such rights might or might not be available; neither does it
represent that it has made any independent effort to identify any such rights. The
OpenID Foundation and the contributors to this specification make no (and hereby
expressly disclaim any) warranties (express, implied, or otherwise), including implied
warranties of merchantability, non-infringement, fitness for a particular purpose, or
title, related to this specification, and the entire risk as to implementing this
specification is assumed by the implementer. The OpenID Intellectual Property
Rights policy (found at openid.net) requires contributors to offer a patent promise not
to assert certain patent claims against other contributors and against implementers.
OpenID invites any interested party to bring to its attention any copyrights, patents,
patent applications, or other proprietary rights that may cover technology that may be
required to practice this specification.
