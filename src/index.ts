import {
  ASTNode,
  DocumentNode,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  SelectionNode,
  FragmentSpreadNode,
  FieldNode
} from "graphql";
import graphql from "graphql-anywhere";

/**
 * High-level overview:
 * The goal is to see if at least one path in the query to check
 * corresponds to the matcher's path. First, we use graphql-anywhere with a
 * custom resolver to run the matcher against the AST of the checked query.
 * The result of that resolution is the ExecutionResult type seen below.
 * The keys of ExecutionResult are the fields of the matcher, with arrays of
 * children to represent the different aliased paths that could be taken in
 * the checked query. An empty child array in ExecutionResult means that no
 * valid path exists at that point in the checked query, and a value of true
 * for a key means that the matcher field is a leaf.
 * After generating the ExecutionResult, we deeply check it to see that there
 * are no impossible paths (that only end in empty child arrays). That's the
 * result - if every field in the matcher is reachable, the query is a match.
 */

export default function doesQueryMatch(
  matcher: DocumentNode,
  queryToCheck: DocumentNode | ApolloInfo
): boolean {
  let topLevelOperation: OperationDefinitionNode | FieldNode[];
  let fragmentDefs: { [fragmentName: string]: FragmentDefinitionNode };
  if (queryToCheck.kind === undefined) {
    if (!queryToCheck.fieldNodes) {
      throw new Error("No query found!");
    }
    topLevelOperation = queryToCheck.fieldNodes;
    fragmentDefs = queryToCheck.fragments;
  } else {
    const opDefinition = queryToCheck.definitions.find(
      isOperationDefinitionNode
    );
    if (opDefinition === undefined) {
      throw new Error("No query found!");
    }
    topLevelOperation = opDefinition;

    fragmentDefs = {};
    if (queryToCheck.kind === "Document") {
      queryToCheck.definitions.forEach(def => {
        if (def.kind === "FragmentDefinition") {
          fragmentDefs[def.name.value] = def;
        }
      });
    }
  }

  const resolve = (node: OperationDefinitionNode | FieldNode) =>
    graphql(
      (
        fieldName,
        rootValue: OperationDefinitionNode | FieldNode,
        args,
        context,
        info
      ) => {
        const isRightSelectionNode = (
          selection: SelectionNode
        ): selection is FieldNode =>
          selection.kind === "Field" && selection.name.value === fieldName;

        if (rootValue.kind === "OperationDefinition") {
          const selections = rootValue.selectionSet.selections.filter(
            isRightSelectionNode
          );
          const fragmentSpreads = rootValue.selectionSet.selections.filter(
            isFragmentSpreadNode
          );
          for (const spread of fragmentSpreads) {
            selections.push(
              ...getFragmentFieldSelections(
                spread.name.value,
                fragmentDefs,
                fieldName
              )
            );
          }
          if (info.isLeaf && selections.length) return true;
          else return selections;
        } else if (rootValue.kind === "Field") {
          if (rootValue.selectionSet) {
            const rightSelectionNodes = rootValue.selectionSet.selections.filter(
              isRightSelectionNode
            );
            const fragmentSpreads = rootValue.selectionSet.selections.filter(
              isFragmentSpreadNode
            );
            for (const spread of fragmentSpreads) {
              rightSelectionNodes.push(
                ...getFragmentFieldSelections(
                  spread.name.value,
                  fragmentDefs,
                  fieldName
                )
              );
            }
            if (info.isLeaf && rightSelectionNodes.length) return true;
            else return rightSelectionNodes;
          } else {
            return [];
          }
        } else {
          console.log(JSON.stringify(rootValue));
          throw new Error("Didn't expect to get this far");
        }
      },
      matcher,
      node
    );

  if (Array.isArray(topLevelOperation)) {
    return topLevelOperation
      .map(resolve)
      .some(res => !hasOnlyDeepEmptyArrays(res));
  } else {
    return !hasOnlyDeepEmptyArrays(resolve(topLevelOperation));
  }
}

function getFragmentFieldSelections(
  fragmentName: string,
  fragments: { [fragmentName: string]: FragmentDefinitionNode },
  fieldName: string
): FieldNode[] {
  const resultFields: FieldNode[] = [];
  const fragment = fragments[fragmentName];
  if (fragment) {
    fragment.selectionSet.selections.forEach(selection => {
      if (selection.kind === "Field") {
        if (selection.name.value === fieldName) {
          resultFields.push(selection);
        }
      } else if (selection.kind === "FragmentSpread") {
        resultFields.push(
          ...getFragmentFieldSelections(
            selection.name.value,
            fragments,
            fieldName
          )
        );
      }
    });
  } else {
    throw new Error(`Referenced non-existent fragment ${fragmentName}`);
  }
  return resultFields;
}

interface ExecutionResult {
  [key: string]: ExecutionResult[] | true;
}

function hasOnlyDeepEmptyArrays(result: ExecutionResult): boolean {
  for (const key in result) {
    const resultForKey = result[key];
    if (
      typeof resultForKey !== "boolean" &&
      resultForKey.filter(hasOnlyDeepEmptyArrays).length === resultForKey.length
    ) {
      return true;
    }
  }
  return false;
}

function isOperationDefinitionNode(
  node: ASTNode
): node is OperationDefinitionNode {
  return node.kind === "OperationDefinition";
}

function isFragmentSpreadNode(node: ASTNode): node is FragmentSpreadNode {
  return node.kind === "FragmentSpread";
}

interface ApolloInfo {
  kind?: never;
  fieldNodes: FieldNode[];
  fragments: { [fragmentName: string]: FragmentDefinitionNode };
}
