import { Problem } from './models';

/** Normalised error thrown by the problem+json interceptor. */
export class ProblemError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ProblemError';
  }
  get status(): number {
    return this.problem.status;
  }
}
