# `graphql-query-match`

Check the contents of GraphQL queries using other GraphQL queries. Works with compiled GraphQL queries as well as `apollo-server` query subtrees.

API examples:

```javascript
import doesQueryMatch from "graphql-query-match";
import gql from "graphql-tag";

const myQuery = gql`
  {
    county {
      cities {
        parks {
          name
        }
        lakes {
          area
        }
      }
    }
  }
`;

// true
const queryHasParkNames = doesQueryMatch(
  gql`
    {
      county {
        cities {
          parks {
            name
          }
        }
      }
    }
  `,
  myQuery
);

// true
const queryHasCities = doesQueryMatch(
  gql`
    {
      county {
        cities
      }
    }
  `,
  myQuery
);

// false
const queryHasFairs = doesQueryMatch(
  gql`
    {
      county {
        fairs
      }
    }
  `,
  myQuery
);
```

The main use case for this is in `apollo-server`:

```javascript
import doesQueryMatch from "graphql-query-match";
import gql from "graphql-tag";

const parksMatcher = gql`
  {
    parks
  }
`;

const resolvers = {
  County: {
    cities: (countyObj, vars, ctx, queryInfo) => {
      if (doesQueryMatch(parksMatcher, queryInfo)) {
        ctx.prefetchParks(countyObj.id);
      }
      return ctx.getCities(countyObj.id);
    }
  }
};
```
