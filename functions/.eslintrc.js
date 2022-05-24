module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    "max-len": ["error", {"code": 120}],
    "quotes": ["error", "double"],
    "linebreak-style": 0,
  },
};
