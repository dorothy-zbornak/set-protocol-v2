import "module-alias/register";

import { Account } from "@utils/test/types";
import { ADDRESS_ZERO, ONE, ZERO, EMPTY_BYTES, ETH_ADDRESS } from "@utils/constants";
import { ZeroExApiAdapter, ZeroExMock } from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import { addSnapshotBeforeRestoreAfterEach, getAccounts, getWaffleExpect } from "@utils/test/index";
import { hexUtils } from "@0x/utils";
import { take } from "lodash";

const expect = getWaffleExpect();

describe("ZeroExApiAdapter", () => {
  let owner: Account;
  const sourceToken = "0x6cf5f1d59fddae3a688210953a512b6aee6ea643";
  const destToken = "0x5e5d0bea9d4a15db2d0837aff0435faba166190d";
  const otherToken = "0xae9902bb655de1a67f334d8661b3ae6a96723d5b";
  const extraHopToken = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
  const destination = "0x89b3515cad4f23c1deacea79fc12445cc21bd0e1";
  const otherDestination = "0xdeb100c55cccfd6e39753f78c8b0c3bcbef86157";
  const sourceQuantity = ONE;
  const minDestinationQuantity = ONE.mul(2);
  const otherQuantity = ONE.div(2);
  let deployer: DeployHelper;

  let zeroExMock: ZeroExMock;
  let zeroExApiAdapter: ZeroExApiAdapter;

  before(async () => {
    [owner] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);

    // Mock OneInch exchange that allows for only fixed exchange amounts
    zeroExMock = await deployer.mocks.deployZeroExMock(ADDRESS_ZERO, ADDRESS_ZERO, ZERO, ZERO);
    zeroExApiAdapter = await deployer.adapters.deployZeroExApiAdapter(zeroExMock.address);
  });

  addSnapshotBeforeRestoreAfterEach();

  describe("getTradeCalldata", () => {
    it("rejects unsupported function", async () => {
      const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
        sourceToken,
        destToken,
        sourceQuantity,
        minDestinationQuantity,
        [],
      ]);
      const tx = zeroExApiAdapter.getTradeCalldata(
        sourceToken,
        destToken,
        destination,
        sourceQuantity,
        minDestinationQuantity,
        "0x01234567" + data.slice(10),
      );
      await expect(tx).to.be.revertedWith("Unsupported 0xAPI function selector");
    });

    it("rejects data with less than 4 length", async () => {
      const tx = zeroExApiAdapter.getTradeCalldata(
        sourceToken,
        destToken,
        destination,
        sourceQuantity,
        minDestinationQuantity,
        "0x",
      );
      await expect(tx).to.be.revertedWith("Invalid calldata");
    });

    describe("transformERC20", () => {
      it("validates data", async () => {
        const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
          sourceToken,
          destToken,
          sourceQuantity,
          minDestinationQuantity,
          [],
        ]);
        const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        expect(target).to.eq(zeroExMock.address);
        expect(value).to.deep.eq(ZERO);
        expect(_data).to.deep.eq(data);
      });

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
          otherToken,
          destToken,
          sourceQuantity,
          minDestinationQuantity,
          [],
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
          sourceToken,
          otherToken,
          sourceQuantity,
          minDestinationQuantity,
          [],
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
          sourceToken,
          destToken,
          otherQuantity,
          minDestinationQuantity,
          [],
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("transformERC20", [
          sourceToken,
          destToken,
          sourceQuantity,
          otherQuantity,
          [],
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });
    });

    describe("sellToUniswap", () => {
      it("validates data", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [sourceToken, destToken],
          sourceQuantity,
          minDestinationQuantity,
          false,
        ]);
        const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        expect(target).to.eq(zeroExMock.address);
        expect(value).to.deep.eq(ZERO);
        expect(_data).to.deep.eq(data);
      });

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [otherToken, destToken],
          sourceQuantity,
          minDestinationQuantity,
          false,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [sourceToken, otherToken],
          sourceQuantity,
          minDestinationQuantity,
          false,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [sourceToken, destToken],
          otherQuantity,
          minDestinationQuantity,
          false,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [sourceToken, destToken],
          sourceQuantity,
          otherQuantity,
          false,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });

      it("rejects invalid uniswap path", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToUniswap", [
          [sourceToken],
          sourceQuantity,
          otherQuantity,
          false,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Uniswap token path too short");
      });
    });

    describe("sellToLiquidityProvider", () => {
      it("validates data", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          sourceToken,
          destToken,
          ADDRESS_ZERO,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          EMPTY_BYTES,
        ]);
        const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        expect(target).to.eq(zeroExMock.address);
        expect(value).to.deep.eq(ZERO);
        expect(_data).to.deep.eq(data);
      });

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          otherToken,
          destToken,
          ADDRESS_ZERO,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          EMPTY_BYTES,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          sourceToken,
          otherToken,
          ADDRESS_ZERO,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          EMPTY_BYTES,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          sourceToken,
          destToken,
          ADDRESS_ZERO,
          destination,
          otherQuantity,
          minDestinationQuantity,
          EMPTY_BYTES,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          sourceToken,
          destToken,
          ADDRESS_ZERO,
          destination,
          sourceQuantity,
          otherQuantity,
          EMPTY_BYTES,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });

      it("rejects wrong destination", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellToLiquidityProvider", [
          sourceToken,
          destToken,
          ADDRESS_ZERO,
          otherDestination,
          sourceQuantity,
          otherQuantity,
          EMPTY_BYTES,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched recipient");
      });
    });

    describe("batchFill", () => {
      it("validates data", async () => {
        const data = zeroExMock.interface.encodeFunctionData("batchFill", [
          {
            inputToken: sourceToken,
            outputToken: destToken,
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        expect(target).to.eq(zeroExMock.address);
        expect(value).to.deep.eq(ZERO);
        expect(_data).to.deep.eq(data);
      });

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("batchFill", [
          {
            inputToken: otherToken,
            outputToken: destToken,
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("batchFill", [
          {
            inputToken: sourceToken,
            outputToken: otherToken,
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("batchFill", [
          {
            inputToken: sourceToken,
            outputToken: destToken,
            sellAmount: otherQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("batchFill", [
          {
            inputToken: sourceToken,
            outputToken: destToken,
            sellAmount: sourceQuantity,
            calls: [],
          },
          otherQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });
    });

    describe("multiHopFill", () => {
      it("validates data", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [sourceToken, destToken],
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        expect(target).to.eq(zeroExMock.address);
        expect(value).to.deep.eq(ZERO);
        expect(_data).to.deep.eq(data);
      });

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [otherToken, destToken],
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects went path too short", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [sourceToken],
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Multihop token path too short");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [sourceToken, otherToken],
            sellAmount: sourceQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [sourceToken, destToken],
            sellAmount: otherQuantity,
            calls: [],
          },
          minDestinationQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("multiHopFill", [
          {
            tokens: [sourceToken, destToken],
            sellAmount: sourceQuantity,
            calls: [],
          },
          otherQuantity,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });
    });
  });
  describe("Uniswap V3", () => {
    const POOL_FEE = 1234;
    function encodePath(tokens_: string[]): string {
      const elems: string[] = [];
      tokens_.forEach((t, i) => {
        if (i) {
          elems.push(hexUtils.leftPad(POOL_FEE, 3));
        }
        elems.push(hexUtils.leftPad(t, 20));
      });
      return hexUtils.concat(...elems);
    }

    describe("sellTokenForTokenToUniswapV3", () => {
      const additionalHops = [otherToken, extraHopToken];
      for (let i = 0; i <= additionalHops.length; i++) {
        const hops = take(additionalHops, i);
        it(`validates data for ${i + 1} hops`, async () => {
          const path = [sourceToken, ...hops, destToken];

          const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
            encodePath(path),
            sourceQuantity,
            minDestinationQuantity,
            destination,
          ]);
          const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
            sourceToken,
            destToken,
            destination,
            sourceQuantity,
            minDestinationQuantity,
            data,
          );
          expect(target).to.eq(zeroExMock.address);
          expect(value).to.deep.eq(ZERO);
          expect(_data).to.deep.eq(data);
        });
      }

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([otherToken, destToken]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([sourceToken, otherToken]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([sourceToken, destToken]),
          otherQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([sourceToken, destToken]),
          sourceQuantity,
          otherQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });

      it("rejects invalid uniswap path", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([sourceToken]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("UniswapV3 token path too short");
      });

      it("rejects wrong destination", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForTokenToUniswapV3", [
          encodePath([sourceToken, destToken]),
          sourceQuantity,
          minDestinationQuantity,
          ADDRESS_ZERO,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched recipient");
      });
    });

    describe("sellTokenForEthToUniswapV3", () => {
      const additionalHops = [otherToken, extraHopToken];
      for (let i = 0; i <= additionalHops.length; i++) {
        const hops = take(additionalHops, i);
        it(`validates data for ${i + 1} hops`, async () => {
          const path = [sourceToken, ...hops, ETH_ADDRESS];

          const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
            encodePath(path),
            sourceQuantity,
            minDestinationQuantity,
            destination,
          ]);
          const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
            sourceToken,
            ETH_ADDRESS,
            destination,
            sourceQuantity,
            minDestinationQuantity,
            data,
          );
          expect(target).to.eq(zeroExMock.address);
          expect(value).to.deep.eq(ZERO);
          expect(_data).to.deep.eq(data);
        });
      }

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([otherToken, ETH_ADDRESS]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([sourceToken, otherToken]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong input token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([sourceToken, ETH_ADDRESS]),
          otherQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token quantity");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([sourceToken, ETH_ADDRESS]),
          sourceQuantity,
          otherQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });

      it("rejects invalid uniswap path", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([sourceToken]),
          sourceQuantity,
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("UniswapV3 token path too short");
      });

      it("rejects wrong destination", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellTokenForEthToUniswapV3", [
          encodePath([sourceToken, ETH_ADDRESS]),
          sourceQuantity,
          minDestinationQuantity,
          ADDRESS_ZERO,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          sourceToken,
          ETH_ADDRESS,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched recipient");
      });
    });

    describe("sellEthForTokenToUniswapV3", () => {
      const additionalHops = [otherToken, extraHopToken];
      for (let i = 0; i <= additionalHops.length; i++) {
        const hops = take(additionalHops, i);
        it(`validates data for ${i + 1} hops`, async () => {
          const path = [ETH_ADDRESS, ...hops, destToken];

          const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
            encodePath(path),
            minDestinationQuantity,
            destination,
          ]);
          const [target, value, _data] = await zeroExApiAdapter.getTradeCalldata(
            ETH_ADDRESS,
            destToken,
            destination,
            sourceQuantity,
            minDestinationQuantity,
            data,
          );
          expect(target).to.eq(zeroExMock.address);
          expect(value).to.deep.eq(sourceQuantity);
          expect(_data).to.deep.eq(data);
        });
      }

      it("rejects wrong input token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
          encodePath([ETH_ADDRESS, destToken]),
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          otherToken,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched input token");
      });

      it("rejects wrong output token", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
          encodePath([ETH_ADDRESS, otherToken]),
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          ETH_ADDRESS,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token");
      });

      it("rejects wrong output token quantity", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
          encodePath([ETH_ADDRESS, destToken]),
          otherQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          ETH_ADDRESS,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched output token quantity");
      });

      it("rejects invalid uniswap path", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
          encodePath([ETH_ADDRESS]),
          minDestinationQuantity,
          destination,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          ETH_ADDRESS,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("UniswapV3 token path too short");
      });

      it("rejects wrong destination", async () => {
        const data = zeroExMock.interface.encodeFunctionData("sellEthForTokenToUniswapV3", [
          encodePath([ETH_ADDRESS, destToken]),
          minDestinationQuantity,
          ADDRESS_ZERO,
        ]);
        const tx = zeroExApiAdapter.getTradeCalldata(
          ETH_ADDRESS,
          destToken,
          destination,
          sourceQuantity,
          minDestinationQuantity,
          data,
        );
        await expect(tx).to.be.revertedWith("Mismatched recipient");
      });
    });
  });
});
