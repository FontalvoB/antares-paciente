"""Infra aislada y publicación del build WEB. Requiere AWS CLI y dist/ existente."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / 'infra' / 'coppadresd-app-test' / 'resources.json'
ACCOUNT = '933629770820'
BUCKET = 'coppadresd-app-test-web-933629770820'
REGION = 'us-east-2'
PROFILE = 'fya-root'
DISABLED = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad'
OPTIMIZED = '658327ea-f89d-4fab-a63d-7e88639e58f6'
ALL_EXCEPT_HOST = 'b689b0a8-53d0-40ab-baf2-68738e2966ac'


def aws(*args, payload=None):
    with tempfile.TemporaryDirectory(prefix='coppadresd-app-test-') as tmp:
        command = ['aws', *args]
        if payload:
            flag, data = payload
            path = Path(tmp) / 'payload.json'
            path.write_text(json.dumps(data), encoding='utf-8')
            command += [flag, f'file://{path.as_posix()}']
        command += ['--profile', PROFILE, '--region', REGION, '--output', 'json', '--no-cli-pager']
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8')
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        return json.loads(result.stdout) if result.stdout.strip() else {}


def save(state):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')


def create():
    if STATE.exists():
        raise RuntimeError('Ya existe resources.json: usar --upload, sin recrear recursos.')
    # No se adopta ni altera un bucket preexistente.
    check = subprocess.run(['aws', 's3api', 'head-bucket', '--bucket', BUCKET, '--profile', PROFILE], capture_output=True, text=True)
    if check.returncode == 0 or '404' not in check.stderr:
        raise RuntimeError('El bucket ya existe o no se puede verificar su ausencia. Se aborta.')
    aws('s3api', 'create-bucket', '--bucket', BUCKET, '--create-bucket-configuration', f'LocationConstraint={REGION}')
    state = {'account': ACCOUNT, 'region': REGION, 'bucket': BUCKET, 'bucketArn': f'arn:aws:s3:::{BUCKET}'}
    save(state)
    aws('s3api', 'put-bucket-tagging', '--bucket', BUCKET, payload=('--tagging', {'TagSet': [{'Key': 'Name', 'Value': 'coppadresd-app-test-web'}, {'Key': 'Purpose', 'Value': 'coppadresd-app-test'}]}))
    aws('s3api', 'put-public-access-block', '--bucket', BUCKET, payload=('--public-access-block-configuration', dict(BlockPublicAcls=True, IgnorePublicAcls=True, BlockPublicPolicy=True, RestrictPublicBuckets=True)))
    aws('s3api', 'put-bucket-website', '--bucket', BUCKET, payload=('--website-configuration', {'IndexDocument': {'Suffix': 'index.html'}, 'ErrorDocument': {'Key': 'index.html'}}))
    # Website habilitado; CloudFront usa el origen REST privado con OAC y HTTPS.
    oac = aws('cloudfront', 'create-origin-access-control', payload=('--origin-access-control-config', {'Name': 'coppadresd-app-test-web-oac', 'Description': 'coppadresd-app-test only', 'SigningProtocol': 'sigv4', 'SigningBehavior': 'always', 'OriginAccessControlOriginType': 's3'}))['OriginAccessControl']['Id']
    state['originAccessControlId'] = oac
    save(state)
    api_behavior = {'TargetOriginId': 'coppadresd-app-test-api', 'ViewerProtocolPolicy': 'redirect-to-https', 'AllowedMethods': {'Quantity': 7, 'Items': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'], 'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']}}, 'CachePolicyId': DISABLED, 'OriginRequestPolicyId': ALL_EXCEPT_HOST, 'Compress': True}
    config = {
        'CallerReference': f'coppadresd-app-test-{int(time.time())}',
        'Comment': 'CoppAddresd-App-Test', 'Enabled': True,
        'DefaultRootObject': 'index.html', 'PriceClass': 'PriceClass_100',
        'HttpVersion': 'http2', 'IsIPV6Enabled': True,
        'ViewerCertificate': {'CloudFrontDefaultCertificate': True},
        'Origins': {'Quantity': 2, 'Items': [
            {'Id': 'coppadresd-app-test-s3', 'DomainName': f'{BUCKET}.s3.{REGION}.amazonaws.com', 'OriginAccessControlId': oac, 'S3OriginConfig': {'OriginAccessIdentity': ''}},
            {'Id': 'coppadresd-app-test-api', 'DomainName': 'erp.coppadresd.com', 'CustomOriginConfig': {'HTTPPort': 80, 'HTTPSPort': 443, 'OriginProtocolPolicy': 'https-only', 'OriginSslProtocols': {'Quantity': 1, 'Items': ['TLSv1.2']}, 'OriginReadTimeout': 60, 'OriginKeepaliveTimeout': 5}}
        ]},
        'DefaultCacheBehavior': {'TargetOriginId': 'coppadresd-app-test-s3', 'ViewerProtocolPolicy': 'redirect-to-https', 'AllowedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD'], 'CachedMethods': {'Quantity': 2, 'Items': ['GET', 'HEAD']}}, 'CachePolicyId': OPTIMIZED, 'Compress': True},
        'CacheBehaviors': {'Quantity': 3, 'Items': [
            {'PathPattern': '/api/*', **api_behavior},
            {'PathPattern': '/storage/*', **api_behavior},
            {'PathPattern': '/index.html', 'TargetOriginId': 'coppadresd-app-test-s3', 'ViewerProtocolPolicy': 'redirect-to-https', 'CachePolicyId': DISABLED, 'Compress': True}
        ]},
    }
    distribution = aws('cloudfront', 'create-distribution-with-tags', payload=('--distribution-config-with-tags', {'DistributionConfig': config, 'Tags': {'Items': [{'Key': 'Name', 'Value': 'coppadresd-app-test-web'}, {'Key': 'DisplayName', 'Value': 'CoppAddresd-App-Test'}, {'Key': 'Purpose', 'Value': 'coppadresd-app-test'}]}}))['Distribution']
    state.update(distributionId=distribution['Id'], distributionArn=distribution['ARN'], domain=distribution['DomainName'], url=f"https://{distribution['DomainName']}")
    save(state)
    (STATE.parent / 'distribution-config.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    policy = {'Version': '2012-10-17', 'Statement': [{'Sid': 'AllowOnlyAppTestCloudFront', 'Effect': 'Allow', 'Principal': {'Service': 'cloudfront.amazonaws.com'}, 'Action': 's3:GetObject', 'Resource': f'arn:aws:s3:::{BUCKET}/*', 'Condition': {'StringEquals': {'AWS:SourceArn': state['distributionArn']}}}]}
    aws('s3api', 'put-bucket-policy', '--bucket', BUCKET, payload=('--policy', policy))
    print(json.dumps(state, indent=2))


def upload():
    state = json.loads(STATE.read_text(encoding='utf-8'))
    if state['bucket'] != BUCKET or state['account'] != ACCOUNT:
        raise RuntimeError('El estado no corresponde al despliegue autorizado.')
    tags = aws('cloudfront', 'list-tags-for-resource', '--resource', state['distributionArn'])['Tags']['Items']
    if {'Key': 'Purpose', 'Value': 'coppadresd-app-test'} not in tags:
        raise RuntimeError('Distribución sin tag de aislamiento; se aborta.')
    if not (ROOT / 'dist' / 'index.html').exists():
        raise RuntimeError('Falta dist/index.html: ejecutar node scripts/build-test-web.mjs.')
    # No --delete: otros assets de ESTE bucket pueden estar en uso por sesiones abiertas.
    subprocess.run(['aws', 's3', 'sync', str(ROOT / 'dist'), f's3://{BUCKET}/', '--exclude', '*.html', '--cache-control', 'public,max-age=31536000,immutable', '--profile', PROFILE, '--region', REGION, '--only-show-errors'], check=True)
    subprocess.run(['aws', 's3', 'cp', str(ROOT / 'dist' / 'index.html'), f's3://{BUCKET}/index.html', '--content-type', 'text/html', '--cache-control', 'no-cache,max-age=0,must-revalidate', '--profile', PROFILE, '--region', REGION, '--only-show-errors'], check=True)
    aws('cloudfront', 'create-invalidation', '--distribution-id', state['distributionId'], '--paths', '/', '/index.html')
    print(f"Build publicado: {state['url']}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--create', action='store_true')
    parser.add_argument('--upload', action='store_true')
    args = parser.parse_args()
    if aws('sts', 'get-caller-identity')['Account'] != ACCOUNT:
        raise RuntimeError('Cuenta AWS distinta de la autorizada.')
    if args.create:
        create()
    if args.upload:
        upload()
