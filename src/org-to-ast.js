import { parse as orga } from 'orga';
import traverse from 'traverse';
import StructuredSource from 'structured-source';
import { nodeTypes, tagNameToType } from './mapping';

function removeUnusedProperties(node) {
  if (typeof node !== 'object') {
    return;
  }
  ['position'].forEach((key) => {
    if (node.hasOwnProperty(key)) {
      delete node[key];
    }
  });
}

function mapNodeType(node, parent) {
  if (parent) {
    const parentNode = parent.parent.node;
    if (parentNode.tagName === 'script' || parentNode.tagName === 'style') {
      return 'CodeBlock';
    }
  }
  if (node.tagName && node.type === 'element') {
    const mappedType = tagNameToType[node.tagName];
    if (mappedType) {
      // p => Paragraph...
      return mappedType;
    }
    // other element is 'Org'
    return 'Org';
  }

  return nodeTypes[node.type];
}

export function parse(org) {
  const ast = orga(org);
  const src = new StructuredSource(org);
  const tr = traverse(ast);
  tr.forEach(function (node) {
    if (this.notLeaf) {
      // avoid conflict <input type='text' />
      // AST node has type and position
      if (node.type && node.position) {
        // case: element => Html or ...
        node.type = mapNodeType(node, this.parent);
      } else if (node.type === 'root') {
        // FIXME: workaround, should fix hast
        node.type = nodeTypes[node.type];
        const position = src.rangeToLocation([0, org.length]);
        // reverse adjust
        node.position = {
          start: {line: position.start.line, column: position.start.column + 1},
          end: {line: position.end.line, column: position.end.column + 1}
        };
      }
      // Unknown type
      if (typeof node.type === 'undefined') {
        node.type = 'UNKNOWN';
      }
      delete node.parent;
      // map `range`, `loc` and `raw` to node
      if (typeof node.position === 'object') {
        const position = node.position;
        // TxtNode's line start with 1
        // TxtNode's column start with 0
        const positionCompensated = {
          start: { line: position.start.line, column: position.start.column - 1 },
          end: { line: position.end.line, column: position.end.column - 1 }
        };
        const range = src.locationToRange(positionCompensated);
        node.loc = positionCompensated;
        node.range = range;
        node.raw = org.slice(range[0], range[1]);
      }
      // map `url` to Link node
      if (node.type === 'Link' && typeof node.properties.href !== 'undefined') {
        node.url = node.properties.href;
      }
    }
    removeUnusedProperties(node);
  });
  return ast;
}
