import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { loadContract } from './config';
import { ApiResponse } from './api-client';

export interface ContractResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates real HTTP responses against the response schemas of the shared OpenAPI document.
 * The whole spec is registered as one JSON Schema document so `$ref: '#/components/...'` resolves.
 */
export class ContractValidator {
  private readonly spec = loadContract();
  private readonly ajv = new Ajv({ strict: false, allErrors: true });

  constructor() {
    addFormats(this.ajv);
    this.ajv.addSchema(this.spec, 'spec');
  }

  private esc(s: string): string {
    return s.replace(/~/g, '~0').replace(/\//g, '~1');
  }

  /** Maps a concrete path (/v1/campaigns/abc) to its template (/v1/campaigns/{id}). */
  private template(path: string): string | undefined {
    return Object.keys(this.spec.paths).find((tpl) =>
      new RegExp('^' + tpl.replace(/\{[^}]+\}/g, '[^/]+') + '$').test(path),
    );
  }

  validate(res: ApiResponse): ContractResult {
    const tpl = this.template(res.path);
    if (!tpl) return { valid: false, errors: [`path ${res.path} is not in the contract`] };
    const op = this.spec.paths[tpl][res.method.toLowerCase()];
    if (!op) return { valid: false, errors: [`${res.method} ${tpl} is not in the contract`] };
    let response = op.responses?.[String(res.status)];
    if (!response) {
      return { valid: false, errors: [`status ${res.status} is not documented for ${res.method} ${tpl}`] };
    }
    let base = `spec#/paths/${this.esc(tpl)}/${res.method.toLowerCase()}/responses/${res.status}`;
    if (response.$ref) {
      base = 'spec' + response.$ref; // e.g. #/components/responses/Problem
      response = this.resolve(response.$ref);
    }
    const mediaType = (res.contentType.split(';')[0] || '').trim();
    if (!response.content) {
      return res.body === undefined
        ? { valid: true, errors: [] }
        : { valid: false, errors: ['contract documents no body but one was returned'] };
    }
    if (!response.content[mediaType]) {
      return { valid: false, errors: [`media type '${mediaType}' not documented (expected ${Object.keys(response.content).join(', ')})`] };
    }
    const validate: ValidateFunction | undefined = this.ajv.getSchema(
      `${base}/content/${this.esc(mediaType)}/schema`,
    );
    if (!validate) return { valid: false, errors: ['could not compile schema'] };
    const ok = validate(res.body) as boolean;
    return {
      valid: ok,
      errors: (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`),
    };
  }

  /** Validates an arbitrary component schema, e.g. 'Campaign'. */
  validateSchema(name: string, data: unknown): ContractResult {
    const validate = this.ajv.getSchema(`spec#/components/schemas/${name}`)!;
    const ok = validate(data) as boolean;
    return { valid: ok, errors: (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`) };
  }

  private resolve(ref: string): any {
    return ref
      .replace(/^#\//, '')
      .split('/')
      .reduce((node: any, key) => node[key.replace(/~1/g, '/').replace(/~0/g, '~')], this.spec);
  }
}
