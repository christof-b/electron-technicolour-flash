import {
  expect
} from "chai";
import testUtils from "./utils";

describe("application launch", () => {
  beforeEach(testUtils.beforeEach);
  afterEach(testUtils.afterEach);

  it("shows welcome text on screen after launch", function() {
    return this.app.client.getText("#intro").then(text => {
      expect(text).to.contain("Electron Technicolour Flash");
    });
  });
});