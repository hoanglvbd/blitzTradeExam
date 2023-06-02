import { BigNumber } from "ethers";

//
export type FetchNativeBalanceType = {
  walletAddress: string;
  balance: BigNumber;
  balanceToString: string;
};

export type FetchERCBalanceType = {
  walletAddress: string;
  tokenAddress: string;
  balance: BigNumber;
  balanceToString: string;
};

export type Row = {
  walletAddress?: string;
  ETHBalance?: string;
  [key: string]: string | undefined;
};
