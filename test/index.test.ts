import { describe, it, expect } from 'vitest';
import { parseWorkflowInputs } from '../src/index';

describe('parseWorkflowInputs', () => {
  it('returns empty array when workflow_dispatch is absent', () => {
    const yaml = `
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
`;
    expect(parseWorkflowInputs(yaml)).toEqual([]);
  });

  it('returns empty array when inputs section is absent', () => {
    const yaml = `
on:
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
`;
    expect(parseWorkflowInputs(yaml)).toEqual([]);
  });

  it('parses a simple string input with description and default', () => {
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: false
        default: 'staging'
`;
    expect(parseWorkflowInputs(yaml)).toEqual([
      {
        name: 'environment',
        description: 'Target environment',
        required: false,
        default: 'staging',
        type: 'string',
      },
    ]);
  });

  it('parses multiple inputs including required ones', () => {
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'Git ref'
        required: true
        default: 'main'
      debug:
        description: 'Enable debug'
        required: false
        default: 'false'
        type: boolean
`;
    expect(parseWorkflowInputs(yaml)).toEqual([
      {
        name: 'ref',
        description: 'Git ref',
        required: true,
        default: 'main',
        type: 'string',
      },
      {
        name: 'debug',
        description: 'Enable debug',
        required: false,
        default: 'false',
        type: 'boolean',
      },
    ]);
  });

  it('collects options for a choice type input', () => {
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      region:
        description: 'Region'
        required: true
        type: choice
        options:
          - us-east
          - "eu-west"
          - 'ap-northeast'
`;
    expect(parseWorkflowInputs(yaml)).toEqual([
      {
        name: 'region',
        description: 'Region',
        required: true,
        default: '',
        type: 'choice',
        options: ['us-east', 'eu-west', 'ap-northeast'],
      },
    ]);
  });

  it('handles multiple inputs with options in sequence', () => {
    const yaml = `
on:
  workflow_dispatch:
    inputs:
      mode:
        type: choice
        options:
          - fast
          - safe
      target:
        description: 'Build target'
`;
    expect(parseWorkflowInputs(yaml)).toEqual([
      {
        name: 'mode',
        description: '',
        required: false,
        default: '',
        type: 'choice',
        options: ['fast', 'safe'],
      },
      {
        name: 'target',
        description: 'Build target',
        required: false,
        default: '',
        type: 'string',
      },
    ]);
  });

  it('tolerates an empty file', () => {
    expect(parseWorkflowInputs('')).toEqual([]);
  });

  it('stops if inputs are not nested under workflow_dispatch', () => {
    const yaml = `
on:
  push:
    branches: [main]
  workflow_dispatch:
`;
    expect(parseWorkflowInputs(yaml)).toEqual([]);
  });
});