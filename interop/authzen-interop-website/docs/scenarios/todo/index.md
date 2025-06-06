---
sidebar_position: 1
---

# Payload Spec

This document lists the request and response payloads for each of the API requests in the Todo interop scenario.

:::danger These payloads and corresponding interop results are for the [AuthZEN 1.0 Draft 00](https://openid.net/specs/authorization-api-1_0-00.html) version of the spec. These results are superseded by the [AuthZEN 1.0 Draft 01 (First Implementers Draft)](../todo-1.0-id/index.md) results. Once all of the implementations in this section switch over to the Implementers Draft, this section will be deleted.
:::

:::tip
This is a copy of the payload document defined by the AuthZEN WG. The definitive document can be found [here](https://hackmd.io/gNZBRoTfRgWh_PNM0y2wDA?view).
:::

## Version history

- 2024-08-13: added `id` keys to all `subject` and `resource` fields to make them compliant with AuthZEN 1.0.
- 2024-02-15: initial draft.

## Overview of the scenario

The Todo application manages a shared todo list between a set of users.

There are 5 actions that the Todo application supports, each with a permission associated with it:

| Action                    | Permission        |
| ------------------------- | ----------------- |
| View a user's information | `can_read_user`   |
| View all Todos            | `can_read_todos`  |
| Create a Todo             | `can_create_todo` |
| (Un)complete a Todo       | `can_update_todo` |
| Delete a Todo             | `can_delete_todo` |

There are four roles defined:

- `viewer` - able to view the shared todo list (`can_read_todos`), as well as information about each of the owners of a Todo (notably, their picture) (`can_read_user`)
- `editor` - `viewer` + the ability to create new Todos (`can_create_todo`), as well as edit and delete Todos _that are owned by that user_
- `admin` - `editor` + the ability to delete any Todos (`can_delete_todo`)
- `evil_genius` - `editor` + the ability to edit Todos that don't belong to the user (`can_update_todo`)

There are 5 users defined (based on the "Rick & Morty" cartoon), each with one (or more) roles, defined below in the Subjects section.

## Component description

The interop consists of the following components:

- a simple React frontend that manages Todo lists.
- a Node.JS backend that serves 5 routes that the frontend talks to.
- external PDPs provided by the interop participants, which the Node.JS backend calls using the AuthZEN API to issue authorization decisions.

The URIs listed in the document below are the contracts between the React app and the Node.JS backend.

The Node.JS backend will take two environment variables - **AUTHZEN_PDP_URL** and **AUTHZEN_PDP_API_KEY** - and use the **AUTHZEN_PDP_URL** to formulate the REST API call to the PDP, using the **AUTHZEN_PDP_API_KEY** as the Authorization header.

The payloads listed below are the contract between the Node.JS backend and the PDP.

The node.js backend is the PEP.

## Subjects

Note: in every request payload, the subject indicated by `<subject_from_jwt>` is one of the following strings:

| User         | PID                                                          |
| ------------ | ------------------------------------------------------------ |
| Rick Sanchez | CiRmZDA2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs |
| Morty Smith  | CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs |
| Summer Smith | CiRmZDI2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs |
| Beth Smith   | CiRmZDM2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs |
| Jerry Smith  | CiRmZDQ2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs |

This will be extracted from the `sub` claim in the JWT passed in as a bearer token in the Authorization header of each request, and passed into the AuthZEN request.

## Attributes associated with users (expected to come from PIP)

These are noted below in JSON format, with the key being the PID string from the table above, and the value being a set of attributes associated with the user.

```js
{
  "CiRmZDA2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs": {
    "id": "rick@the-citadel.com",
    "name": "Rick Sanchez",
    "email": "rick@the-citadel.com",
    "roles": ["admin", "evil_genius"],
    "picture": "https://www.topaz.sh/assets/templates/citadel/img/Rick%20Sanchez.jpg"
  },
  "CiRmZDM2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs": {
    "id": "beth@the-smiths.com",
    "name": "Beth Smith",
    "email": "beth@the-smiths.com",
    "roles": ["viewer"],
    "picture": "https://www.topaz.sh/assets/templates/citadel/img/Beth%20Smith.jpg"
  },
  "CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs": {
    "id": "morty@the-citadel.com",
    "name": "Morty Smith",
    "email": "morty@the-citadel.com",
    "roles": ["editor"],
    "picture": "https://www.topaz.sh/assets/templates/citadel/img/Morty%20Smith.jpg"
  },
  "CiRmZDI2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs": {
    "id": "summer@the-smiths.com",
    "name": "Summer Smith",
    "email": "summer@the-smiths.com",
    "roles": ["editor"],
    "picture": "https://www.topaz.sh/assets/templates/citadel/img/Summer%20Smith.jpg"
  },
  "CiRmZDQ2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs": {
    "id": "jerry@the-smiths.com",
    "name": "Jerry Smith",
    "email": "jerry@the-smiths.com",
    "roles": ["viewer"],
    "picture": "https://www.topaz.sh/assets/templates/citadel/img/Jerry%20Smith.jpg"
  }
}
```

The PIP can, of course, express this in any way they desire. The policy for each implementation has its own contract with its PIP, and this contract is outside of the scope of the PEP-PDP interop scenario.

## Requests and payloads

### `GET /users/{userID}`

Get information (e.g. email, picture) associated with a user. This is used by the backend to render the picture of the user that owns each todo.

For simplicity, the policy always returns `true`.

#### Request payload

```js
{
  "subject": {
    "type": "user",
    "id": "<subject_from_jwt>",
    "identity": "<subject_from_jwt>"
  },
  "action": {
    "name": "can_read_user"
  },
  "resource": {
    "type": "user",
    "id": "<email_OR_subject>",
    "userID": "<email_OR_subject>"
  },
  "context": {
  }
}
```

> Notes:
>
> 1. to make the payload structure interoperable with the original implementation, `subject.identity` is still specified in the payload, even though it is redundant with `subject.type` + `subject.id`.
> 2. likewise, `resource.userID` is still specified, even though it is redundant with `resource.id`.

#### Response payload

For every subject and resource combination:

```js
{
  "decision": true
}
```

### `GET /todos`

Get the list of todos.

For simplicity, the policy always returns `true` for every user.

#### Request payload

```js
{
  "subject": {
    "type": "user",
    "id": "<subject_from_jwt>",
    "identity": "<subject_from_jwt>"
  },
  "action": {
    "name": "can_read_todos"
  },
  "resource": {
    "type": "todo",
    "id": "todo-1"
  },
  "context": {
  }
}
```

> Notes:
>
> 1. to make the payload structure interoperable with the original implementation, `subject.identity` is still specified in the payload, even though it is redundant with `subject.type` + `subject.id`.
> 2. `resource.type` continues to be `todo`, and `resource.id` is specified as a fixed / stable identifier.

#### Response payload

For every subject and resource combination:

```js
{
  "decision": true
}
```

### `POST /todos`

Create a new todo.

The policy evaluates the subject's `roles` attribute to determine whether the user can create a new todo.

#### Request payload

```js
{
  "subject": {
    "type": "user",
    "id": "<subject_from_jwt>",
    "identity": "<subject_from_jwt>"
  },
  "action": {
    "name": "can_create_todo"
  },
  "resource": {
    "type": "todo",
    "id": "todo-1"
  },
  "context": {
  }
}
```

> Notes:
>
> 1. to make the payload structure interoperable with the original implementation, `subject.identity` is still specified in the payload, even though it is redundant with `subject.type` + `subject.id`.
> 2. `resource.type` continues to be `todo`, and `resource.id` is specified as a fixed / stable identifier.

#### Response payload

Only users with a `roles` attribute that contains `admin` or `editor` return a `true` decision. In the user set above, this includes Rick, Morty, and Summer.

```js
{
  "decision": true
}
```

For the other two users, Beth and Jerry, the decision is `false`.

```js
{
  "decision": false
}
```

### `PUT /todos/{id}`

Edit (complete) a todo.

The policy allows the operation if the subject's `roles` attribute contains the `evil_genius` role, OR if the subject's `roles` contains the `editor` role AND the subject is the owner of the todo.

The `resource` contains an attribute called `ownerID` which contains the `id` of the owner (which is defined in the "Attributes" section above, and is the email address of the owner).

#### Request payload

```js
{
  "subject": {
    "type": "user",
    "id": "<subject_from_jwt>",
    "identity": "<subject_from_jwt>"
  },
  "action": {
    "name": "can_update_todo"
  },
  "resource": {
    "type": "todo",
    "id": "<uuid-of-the-todo>",
    "ownerID": "<email_of_owner>"
  },
  "context": {
  }
}
```

> Notes:
>
> 1. to make the payload structure interoperable with the original implementation, `subject.identity` is still specified in the payload, even though it is redundant with `subject.type` + `subject.id`.
> 2. `resource.id` is a UUID representing the Todo, but since the PDPs are not assumed to be stateful, `ownerID` continues to be passed in as a way to designate a Todo's owner.

#### Response payload

Only users with a `roles` attribute that contains `evil_genius` (Rick), OR the owner of the todo, return a `true` decision.

For the user Morty, the following request will return a `true` decision:

```js
{
  "subject": {
    "type": "user",
    "id": "CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs",
    "identity": "CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs"
  },
  "action": {
    "name": "can_update_todo"
  },
  "resource": {
    "type": "todo",
    "id": "7240d0db-8ff0-41ec-98b2-34a096273b9f",
    "ownerID": "morty@the-citadel.com"
  },
  "context": {
  }
}
```

```js
{
  "decision": true
}
```

For a different value of `ownerID`, the decision will be `false`:

```js
{
  "decision": false
}
```

### `DELETE /todos/{id}`

Delete a todo.

The policy allows the operation if the subject's `roles` attribute contains the `admin` role, OR if the subject's `roles` contains the `editor` role AND the subject is the owner of the todo.

The `resource` contains an attribute called `ownerID` which contains the `id` of the owner (which is defined in the "Attributes" section above, and is the email address of the owner).

#### Request payload

```js
{
  "subject": {
    "type": "user",
    "id": "<subject_from_jwt>",
    "identity": "<subject_from_jwt>"
  },
  "action": {
    "name": "can_delete_todo"
  },
  "resource": {
    "type": "todo",
    "id": "<uuid-of-the-todo>",
    "ownerID": "<email_of_owner>"
  },
  "context": {
  }
}
```

> Notes:
>
> 1. to make the payload structure interoperable with the original implementation, `subject.identity` is still specified in the payload, even though it is redundant with `subject.type` + `subject.id`.
> 2. `resource.id` is a UUID representing the Todo, but since the PDPs are not assumed to be stateful, `ownerID` continues to be passed in as a way to designate a Todo's owner.

#### Response payload

Only users with a `roles` attribute that contains `admin` (Rick), OR the owner of the todo, return a `true` decision.

For the user Morty, the following request will return a `true` decision:

```js
{
  "subject": {
    "type": "user",
    "id": "CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs",
    "identity": "CiRmZDE2MTRkMy1jMzlhLTQ3ODEtYjdiZC04Yjk2ZjVhNTEwMGQSBWxvY2Fs"
  },
  "action": {
    "name": "can_delete_todo"
  },
  "resource": {
    "type": "todo",
    "id": "7240d0db-8ff0-41ec-98b2-34a096273b9f",
    "ownerID": "morty@the-citadel.com"
  },
  "context": {
  }
}
```

```js
{
  "decision": true
}
```

For a different value of `ownerID`, the decision will be `false`:

```js
{
  "decision": false
}
```
