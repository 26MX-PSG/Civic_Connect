const { bad } = require('./errors');

const str = (v, name, { min = 0, max = 255, required = true } = {}) => {
  if (v === undefined || v === null || v === '') { if (required) throw bad(name + ' is required'); return null; }
  if (typeof v !== 'string') throw bad(name + ' must be text');
  const t = v.trim();
  if (required && t.length < Math.max(min, 1)) throw bad(name + ' is required');
  if (t.length < min) throw bad(name + ' must be at least ' + min + ' characters');
  if (t.length > max) throw bad(name + ' must be at most ' + max + ' characters');
  return t;
};
const oneOf = (v, list, name) => {
  if (v === undefined || v === null || v === '') return null;
  if (!list.includes(v)) throw bad(name + ' must be one of: ' + list.join(', '));
  return v;
};
const int = (v, name, { min = 0, max = 1e9 } = {}) => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(name + ' must be a whole number between ' + min + ' and ' + max);
  return n;
};
const id = (v, name = 'id') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw bad(name + ' must be a positive whole number');
  return n;
};
const date = (v, name) => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(name + ' must be a date like 2005-06-14');
  const d = new Date(v);
  if (d > new Date()) throw bad(name + ' cannot be in the future');
  if (d.getFullYear() < 1900) throw bad(name + ' is not a valid date');
  return v;
};
const email = (v) => {
  const t = str(v, 'email', { max: 150 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw bad('email is not valid');
  return t;
};

module.exports = { str, oneOf, int, id, date, email };
