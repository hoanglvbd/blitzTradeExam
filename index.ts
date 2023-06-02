import { BigNumber, ethers } from "ethers";
import { ERC20ABI, ERC20Addresses, walletAddresses } from "./constant";
import { FetchERCBalanceType, FetchNativeBalanceType, Row } from "./types";

const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const provider = new ethers.providers.JsonRpcProvider(
  "https://ethereum.publicnode.com"
);

async function main() {
  const totalERCBalance: Record<string, BigNumber> = {};
  const balances: Record<string, Record<string, string>> = {}; // key: wallet address, value: {token address: balance}
  const decimals: Record<string, number> = {};
  console.log("Querying");
  console.time("querying");
  // prefetch decimals
  for (let i = 0; i < ERC20Addresses.length; i++) {
    const contract = new ethers.Contract(
      ethers.utils.getAddress(ERC20Addresses[i]),
      ERC20ABI,
      provider
    );
    const decimal = await contract.decimals();
    decimals[ERC20Addresses[i]] = ethers.BigNumber.from(decimal).toNumber();
  }

  // Fetch ERC balance
  for (let i = 0; i < ERC20Addresses.length; i++) {
    const promisees: Array<Promise<FetchERCBalanceType>> = [];

    walletAddresses.forEach((walletAddress) => {
      promisees.push(
        new Promise<FetchERCBalanceType>((resolve) => {
          const contract = new ethers.Contract(
            ethers.utils.getAddress(ERC20Addresses[i]),
            ERC20ABI,
            provider
          );
          contract
            .balanceOf(ethers.utils.getAddress(walletAddress))
            .then((tokenBalance: BigNumber) => {
              resolve({
                walletAddress,
                tokenAddress: ERC20Addresses[i],
                balance: tokenBalance,
                balanceToString: formatBigNumber(
                  tokenBalance,
                  decimals[ERC20Addresses[i]]
                ),
              });
            });
        })
      );
    });
    const tokenBalances = await Promise.all(promisees);

    tokenBalances.forEach((t) => {
      // Increase total token balance
      totalERCBalance[t.tokenAddress] = ethers.BigNumber.from(
        totalERCBalance[t.tokenAddress] || 0
      ).add(ethers.BigNumber.from(t.balance));
      // store balance key value
      balances[`${t.walletAddress}`] = {
        ...balances[`${t.walletAddress}`],
        [`${t.tokenAddress}`]: t.balanceToString,
      };
    });
  }

  // Fetch native balance
  const promisees: Array<Promise<FetchNativeBalanceType>> = [];
  walletAddresses.forEach((walletAddress) => {
    promisees.push(
      new Promise((resolve) => {
        provider.getBalance(walletAddress).then((balance) => {
          resolve({
            walletAddress,
            balance,
            balanceToString: formatBigNumber(balance, 18),
          });
        });
      })
    );
  });

  const nativeBalances = await Promise.all(promisees);
  nativeBalances.forEach((n) => {
    balances[n.walletAddress] = {
      ...balances[n.walletAddress],
      [ethers.constants.AddressZero]: n.balanceToString,
    };
  });

  console.timeEnd("querying");
  // format data to save
  const rows: Row[] = [];
  Object.keys(balances).forEach((key) => {
    let row: Row = {};

    row.WalletAddress = key;
    Object.keys(balances[key]).forEach((nestedKey) => {
      if (nestedKey === ethers.constants.AddressZero) {
        row.ETHBalance = balances[key][nestedKey];
      } else {
        row[nestedKey] = balances[key][nestedKey];
      }
    });
    rows.push(row);
  });

  const totalRow: Row = {
    walletAddress: "",
    ETHBalance: "Total",
  };
  Object.keys(totalERCBalance).forEach((key) => {
    totalRow[key] = totalERCBalance[key].toString();
  });
  rows.push(totalRow);
  // save
  writeFileCsv(rows);
}

function writeFileCsv(data: Row[]) {
  const headers: Array<{
    id: string;
    title: string;
  }> = [
    { id: "WalletAddress", title: "WalletAddress" },
    { id: "ETHBalance", title: "ETHBalance" },
  ];

  ERC20Addresses.forEach((erc20address) => {
    const newHeader = {
      id: erc20address,
      title: erc20address,
    };
    headers.push(newHeader);
  });

  const fileName = "output.csv";

  const csvWriter = createCsvWriter({
    path: fileName,
    header: headers,
  });

  csvWriter.writeRecords(data).then(() => {
    console.log(`Save results in file! ${fileName}`);
  });
}

function formatBigNumber(num: ethers.BigNumber, decimal: number) {
  return ethers.utils.formatUnits(num.toString(), decimal);
}

main();
