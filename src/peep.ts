/// <reference path="./asm.d.ts" />
import { JSONValue, log, TypedMap } from '@graphprotocol/graph-ts';
import { PostCall, ReplyCall, ShareCall } from '../generated/Contract/Contract';
import { Peep } from '../generated/schema';
import { getGlobalStats } from './global';
import { asString, intValue } from './util';
import { TransactionInfo } from './transaction';
import { loadFromIpfs } from './ipfs';

function incrementNumberOfPeeps(): i32 {
  let global = getGlobalStats();
  global.numberOfPeeps += 1;
  global.save();
  return global.numberOfPeeps;
}

function applyPeepCreationInfo(account: Peep, tx: TransactionInfo): void {
  account.createdInBlock = tx.blockNumber;
  account.createdInTx = tx.hash;
  account.createdTimestamp = tx.timestamp;
}

export function createPeep(data: TypedMap<string, JSONValue>, id: string, tx: TransactionInfo): Peep | null {
  let peepType = 'peep';

  let type = asString(data.get('type'));
  if (type == peepType) {
    let peep = new Peep(id);
    peep.number = incrementNumberOfPeeps();
    peep.account = tx.from.toHex();
    peep.content = asString(data.get('content'));
    peep.pic = asString(data.get('pic'));
    peep.timestamp = intValue(data, 'untrustedTimestamp', 0);
    peep.type = 'PEEP';

    let shareId = asString(data.get('shareID'));
    if (shareId != null) {
      peep.share = shareId;
      peep.type = 'SHARE';
    }

    let replyId = asString(data.get('parentID'));
    if (replyId != null) {
      peep.replyTo = replyId;
      peep.type = 'REPLY';
    }

    applyPeepCreationInfo(peep, tx);
    return peep;
  } else {
    log.warning('[mapping] Ignoring invalid peep of type={} in tx={}', [type, tx.hash.toHex()]);
  }
  return null;
}

export function createPeepFromIPFS(ipfsHash: string, fn: string, tx: TransactionInfo): void {
  let data = loadFromIpfs(ipfsHash, tx);
  if (data !== null) {
    let peep = createPeep(data!, ipfsHash, tx);
    if (peep !== null) {
      peep.save();
    }
  } else {
    log.warning('[mapping] [createPeepFromIPFS] Unable to load data from IPFS hash={} fn={} tx={}', [
      ipfsHash,
      fn,
      tx.toString(),
    ]);
    let globals = getGlobalStats();
    globals.numberOfPeepsNotFound += 1;
    globals.save();
  }
}

export function handlePost(call: PostCall): void {
  createPeepFromIPFS(call.inputs._ipfsHash, 'post', TransactionInfo.fromEthereumCall(call));
}

export function handleShare(call: ShareCall): void {
  createPeepFromIPFS(call.inputs._ipfsHash, 'share', TransactionInfo.fromEthereumCall(call));
}

export function handleReply(call: ReplyCall): void {
  createPeepFromIPFS(call.inputs._ipfsHash, 'reply', TransactionInfo.fromEthereumCall(call));
}
