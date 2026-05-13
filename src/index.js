/**
 * Aliyun CDT Tracker & ECS Control Worker
 * 
 * Required Environment Variables:
 * - ACCESS_KEY_ID: Aliyun Access Key ID
 * - ACCESS_KEY_SECRET: Aliyun Access Key Secret
 * - REGION_ID: ECS Region ID (e.g., cn-hongkong)
 * - ECS_INSTANCE_ID: ECS Instance ID
 * - TRAFFIC_THRESHOLD_GB: Traffic threshold in GB (default: 180)
 */

export default {
  async scheduled(event, env, ctx) {
    console.log("Cron Triggered");
    await handleSchedule(env);
  },

  async fetch(request, env, ctx) {
    await handleSchedule(env);
    return new Response("Executed successfully", { status: 200 });
  }
};

async function handleSchedule(env) {
  const {
    ACCESS_KEY_ID,
    ACCESS_KEY_SECRET,
    REGION_ID,
    ECS_INSTANCE_ID
  } = env;

  if (!ACCESS_KEY_ID || !ACCESS_KEY_SECRET || !REGION_ID || !ECS_INSTANCE_ID) {
    console.error("Missing required environment variables.");
    return;
  }

  const thresholdGB = Number(env.TRAFFIC_THRESHOLD_GB) || 180;

  try {
    const trafficInfo = await getInstanceUsedTrafficGB(env, ECS_INSTANCE_ID);
    const usedGB = trafficInfo.trafficGB;
    console.log(`CDT Used Traffic for ECS ${ECS_INSTANCE_ID}: ${usedGB.toFixed(2)} GB / ${thresholdGB} GB threshold`);

    const instanceStatus = await getEcsStatus(env, ECS_INSTANCE_ID);
    console.log(`ECS Instance ${ECS_INSTANCE_ID} Status: ${instanceStatus}`);

    if (usedGB >= thresholdGB) {
      console.log(`Traffic exceeded threshold (${usedGB.toFixed(2)} >= ${thresholdGB}).`);
      if (instanceStatus === "Running" || instanceStatus === "Starting") {
        console.log("Stopping instance...");
        await stopEcsInstance(env, ECS_INSTANCE_ID);
      } else if (instanceStatus === "Stopped") {
        console.log("Instance already stopped.");
      } else if (instanceStatus === "Stopping") {
        console.log("Instance already stopping.");
      }
      return;
    }

    // Traffic is under threshold
    console.log(`Traffic within limit (${usedGB.toFixed(2)} < ${thresholdGB}).`);
    if (instanceStatus === "Stopped") {
      console.log("Starting instance...");
      await startEcsInstance(env, ECS_INSTANCE_ID);
    } else if (instanceStatus === "Running") {
      console.log("Instance already running.");
    } else if (instanceStatus === "Stopping") {
      console.log("Instance stopping. Waiting...");
    } else {
      console.log(`Instance abnormal state (${instanceStatus}). Rebooting...`);
      await rebootEcsInstance(env, ECS_INSTANCE_ID);
    }

  } catch (error) {
    console.error("Error in execution:", error);
  }
}

// ================== ECS API ==================

async function getInstanceUsedTrafficGB(env, instanceId) {
  const params = {
    Action: 'ListCdtInternetTraffic',
    Version: '2021-08-13'
  };

  const result = await requestAliyun(env, 'cdt.aliyuncs.com', params);
  const trafficDetailsRaw = result?.TrafficDetails;
  const trafficDetails = Array.isArray(trafficDetailsRaw)
    ? trafficDetailsRaw
    : Array.isArray(trafficDetailsRaw?.TrafficDetail)
      ? trafficDetailsRaw.TrafficDetail
      : [];

  let totalBytes = 0;
  let matchedBytes = 0;
  let matchedCount = 0;

  for (const detail of trafficDetails) {
    const trafficValue = Number(detail?.Traffic ?? detail?.TrafficBytes ?? 0);
    const trafficBytes = Number.isFinite(trafficValue) ? trafficValue : 0;
    totalBytes += trafficBytes;

    const resourceId = String(
      detail?.ResourceId ??
      detail?.InstanceId ??
      detail?.ProductInstanceId ??
      detail?.Id ??
      ''
    );

    if (resourceId === instanceId) {
      matchedBytes += trafficBytes;
      matchedCount += 1;
    }
  }

  if (matchedCount > 0) {
    return {
      trafficGB: matchedBytes / (1024 ** 3),
      isMatched: true
    };
  }

  return {
    trafficGB: totalBytes / (1024 ** 3),
    isMatched: false
  };
}

async function getEcsStatus(env, instanceId) {
  const params = {
    Action: 'DescribeInstances',
    Version: '2014-05-26',
    RegionId: env.REGION_ID,
    InstanceIds: JSON.stringify([instanceId])
  };

  const result = await requestAliyun(env, `ecs.${env.REGION_ID}.aliyuncs.com`, params);
  const instances = result.Instances?.Instance || [];

  if (instances.length === 0) {
    throw new Error("Instance not found");
  }

  return instances[0].Status;
}

async function startEcsInstance(env, instanceId) {
  const params = {
    Action: 'StartInstance',
    Version: '2014-05-26',
    RegionId: env.REGION_ID,
    InstanceId: instanceId
  };

  return await requestAliyun(env, `ecs.${env.REGION_ID}.aliyuncs.com`, params);
}

async function stopEcsInstance(env, instanceId) {
  const params = {
    Action: 'StopInstance',
    Version: '2014-05-26',
    RegionId: env.REGION_ID,
    InstanceId: instanceId,
    ForceStop: 'false'
  };

  return await requestAliyun(env, `ecs.${env.REGION_ID}.aliyuncs.com`, params);
}

async function rebootEcsInstance(env, instanceId) {
  const params = {
    Action: 'RebootInstance',
    Version: '2014-05-26',
    RegionId: env.REGION_ID,
    InstanceId: instanceId,
    ForceStop: 'false'
  };

  return await requestAliyun(env, `ecs.${env.REGION_ID}.aliyuncs.com`, params);
}

// ================== Core Request Logic ==================

async function requestAliyun(env, domain, params) {
  const method = 'POST';

  const finalParams = {
    ...params,
    AccessKeyId: env.ACCESS_KEY_ID,
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  };

  const signature = await sign(finalParams, env.ACCESS_KEY_SECRET, method);
  finalParams.Signature = signature;

  const queryString = Object.keys(finalParams)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(String(finalParams[key]))}`)
    .join('&');

  const url = `https://${domain}/?${queryString}`;

  const response = await fetch(url, {
    method: method
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Aliyun API Error: ${response.status} ${response.statusText} - ${text}`);
  }

  return await response.json();
}

async function sign(params, accessKeySecret, method) {
  const canonicalizedQueryString = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(String(params[key]))}`)
    .join('&');

  const stringToSign =
    method.toUpperCase() + '&' +
    percentEncode('/') + '&' +
    percentEncode(canonicalizedQueryString);

  const key = accessKeySecret + '&';

  return await hmacSha1(key, stringToSign);
}

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

async function hmacSha1(key, data) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    dataData
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
