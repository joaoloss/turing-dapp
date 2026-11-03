const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("TuringModule", (m) => {
  const turing = m.contract("Turing");

  return { turing };
});
