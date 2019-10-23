import doesQueryMatch from ".";
import gql from "graphql-tag";
import { DocumentNode, OperationDefinitionNode, FieldNode } from "graphql";

const basicQuery = gql`
  {
    document {
      with {
        nested
      }
      stuff
    }
    even
    outside
  }
`;

test("validates an exact match", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document {
            with {
              nested
            }
            stuff
          }
          even
          outside
        }
      `,
      basicQuery
    )
  ).toBe(true);
});

test("validates without nested fields", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document
          even
          outside
        }
      `,
      basicQuery
    )
  ).toBe(true);
});

test("validates with a subset of fields", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document {
            with {
              nested
            }
          }
        }
      `,
      basicQuery
    )
  ).toBe(true);
});

test("doesn't validate if too deep", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document {
            with {
              nested {
                more
              }
            }
            stuff
          }
          even
          outside
        }
      `,
      basicQuery
    )
  ).toBe(false);
});

test("doesn't validate if too wide", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document {
            with {
              nested
              more
            }
            stuff
          }
          even
          outside
        }
      `,
      basicQuery
    )
  ).toBe(false);
});

test("doesn't validate if root too wide", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          document {
            with {
              nested
            }
            stuff
          }
          even
          more
          outside
        }
      `,
      basicQuery
    )
  ).toBe(false);
});

test("validates named queries", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          named {
            query
          }
          some {
            fields
          }
        }
      `,
      gql`
        query MyQuery {
          named {
            query
          }
          some {
            fields
          }
        }
      `
    )
  ).toBe(true);
});

const queryWithFragments = gql`
  query FragmentQuery {
    first
    second
    ...topLevelFragment
    third {
      a {
        bit {
          deeper {
            ...deepFragment
          }
        }
      }
    }
  }

  fragment topLevelFragment on NoSchema {
    fragment
    fields {
      can
      be {
        deep
      }
    }
  }

  fragment deepFragment on SeriouslyNoSchema {
    another {
      thing {
        with
      }
    }
    some {
      fields
    }
  }
`;

test("accepts fragments", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          first
          second
          third {
            a {
              bit {
                deeper
              }
            }
          }
        }
      `,
      queryWithFragments
    )
  ).toBe(true);
});

test("validates top-level fragments", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          first
          second
          fragment
          fields {
            can
            be {
              deep
            }
          }
        }
      `,
      queryWithFragments
    )
  ).toBe(true);
});

test("validates partial fragments", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          first
          fields {
            be
          }
        }
      `,
      queryWithFragments
    )
  ).toBe(true);
});

test("validates fragments without nested fields", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          first
          fields
        }
      `,
      queryWithFragments
    )
  ).toBe(true);
});

test("validates deep fragments", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          third {
            a {
              bit {
                deeper {
                  another {
                    thing {
                      with
                    }
                  }
                  some {
                    fields
                  }
                }
              }
            }
          }
        }
      `,
      queryWithFragments
    )
  ).toBe(true);
});

const queryWithAliases = gql`
  {
    top {
      nested {
        under
        top {
          super
          deep
        }
      }
    }
    top2: top {
      nested {
        under
        else
      }
    }
    top3: top {
      nested {
        top: deepTop {
          deep
        }
      }
    }
  }
`;

test("validates aliases", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          top {
            nested
          }
        }
      `,
      queryWithAliases
    )
  ).toBe(true);
});

test("validates aliases with at least one correct branch", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          top {
            nested {
              under
              top {
                super
              }
            }
          }
        }
      `,
      queryWithAliases
    )
  ).toBe(true);

  expect(
    doesQueryMatch(
      gql`
        {
          top {
            nested {
              under
              else
            }
          }
        }
      `,
      queryWithAliases
    )
  ).toBe(true);
});

test("doesn't validate aliases with no correct branch", () => {
  expect(
    doesQueryMatch(
      gql`
        {
          top {
            nested {
              not
            }
          }
        }
      `,
      queryWithAliases
    )
  ).toBe(false);
});

test("works with apollo", () => {
  const doc: DocumentNode = gql`
    {
      thing1: thing {
        hello
        goodbye {
          nested
        }
      }
      thing2: thing {
        some {
          other
          stuff
        }
      }
    }
  `;

  const fieldNodes = (doc.definitions[0] as OperationDefinitionNode)
    .selectionSet.selections as FieldNode[];

  const apolloInfo = {
    fieldNodes,
    fragments: {}
  };

  expect(
    doesQueryMatch(
      gql`
        {
          hello
          goodbye {
            nested
          }
        }
      `,
      apolloInfo
    )
  ).toBe(true);

  expect(
    doesQueryMatch(
      gql`
        {
          some {
            other
            stuff
          }
        }
      `,
      apolloInfo
    )
  ).toBe(true);

  expect(
    doesQueryMatch(
      gql`
        {
          thing {
            some {
              other
              stuff
            }
          }
        }
      `,
      apolloInfo
    )
  ).toBe(false);
});
