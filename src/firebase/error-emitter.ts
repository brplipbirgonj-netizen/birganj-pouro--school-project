import { EventEmitter } from 'events';

// This is a global emitter for Firebase errors.
// Components can listen to this emitter to display errors to the user.
export const errorEmitter = new EventEmitter();
